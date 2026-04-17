import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Signature OVH : "$AS+$CK+$METHOD+$URL+$BODY+$TIMESTAMP"
function ovhSign(
  appSecret: string,
  consumerKey: string,
  method: string,
  url: string,
  body: string,
  timestamp: number
): string {
  const pre = [appSecret, consumerKey, method.toUpperCase(), url, body, timestamp].join("+");
  return "$1$" + createHash("sha1").update(pre).digest("hex");
}

async function sendOvhSMS(to: string, message: string) {
  const ak = process.env.OVH_APP_KEY;
  const as = process.env.OVH_APP_SECRET;
  const ck = process.env.OVH_CONSUMER_KEY;
  const serviceName = process.env.OVH_SMS_SERVICE_NAME;

  console.log("[sms/send] OVH config check —", {
    ak_set: !!ak,
    as_set: !!as,
    ck_set: !!ck,
    serviceName,
    to,
  });

  if (!ak || !as || !ck || !serviceName) {
    console.error("[sms/send] ERREUR : variables OVH manquantes", {
      OVH_APP_KEY: !!ak,
      OVH_APP_SECRET: !!as,
      OVH_CONSUMER_KEY: !!ck,
      OVH_SMS_SERVICE_NAME: !!serviceName,
    });
    throw new Error("OVH SMS not configured");
  }

  const url = `https://eu.api.ovh.com/1.0/sms/${serviceName}/jobs`;
  const bodyObj = {
    message,
    receivers: [to],
    sender: "StrangerKis", // max 11 chars alphanumériques pour OVH
  };
  const bodyStr = JSON.stringify(bodyObj);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = ovhSign(as, ck, "POST", url, bodyStr, timestamp);

  console.log("[sms/send] POST →", url, "| timestamp:", timestamp);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Ovh-Application": ak,
      "X-Ovh-Consumer": ck,
      "X-Ovh-Timestamp": String(timestamp),
      "X-Ovh-Signature": signature,
    },
    body: bodyStr,
  });

  console.log("[sms/send] OVH HTTP status:", res.status);

  if (!res.ok) {
    const raw = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { /* non-JSON */ }
    console.error("[sms/send] OVH erreur —", {
      status: res.status,
      errorCode: parsed.errorCode,
      message: parsed.message,
      queryID: parsed.queryID,
      raw: raw.slice(0, 500),
    });
    throw new Error(String(parsed.message ?? raw ?? "OVH SMS error"));
  }

  const result = await res.json();
  console.log("[sms/send] SMS envoyé —", {
    validReceivers: result.validReceivers,
    invalidReceivers: result.invalidReceivers,
    ids: result.ids,
  });
}

/**
 * Normalise un numéro de téléphone vers le format E.164 requis par OVH.
 * - Supprime espaces, tirets, points, parenthèses
 * - Convertit le préfixe `00XX` en `+XX` (ex: 0033... → +33...)
 * - Retourne une chaîne vide si le numéro ne commence pas par `+` après normalisation
 */
function normalizePhone(p: string): string {
  // Supprimer les séparateurs courants
  let n = p.replace(/[\s\-().]/g, "");
  // Convertir 00XX → +XX (format international sans +)
  if (n.startsWith("00")) n = "+" + n.slice(2);
  // Valider le format E.164 : doit commencer par + suivi de 7 à 15 chiffres
  if (!/^\+\d{7,15}$/.test(n)) return "";
  return n;
}

// POST /api/sms/send  { phone }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone((body.phone as string)?.trim() ?? "");
  console.log("[sms/send] Demande reçue — phone:", phone ? phone.slice(0, 4) + "****" : "(vide)");

  if (!phone) {
    const raw = ((body.phone as string)?.trim() ?? "");
    const isFormatError = raw.length > 0; // non vide mais format invalide
    console.warn("[sms/send] Format téléphone invalide — reçu:", raw ? raw.slice(0, 4) + "****" : "(vide)");
    return NextResponse.json(
      { error: isFormatError ? "phone_invalid" : "phone_required" },
      { status: 400 }
    );
  }

  // Déjà vérifié ?
  const { data: existing, error: existingError } = await sb
    .from("users")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existingError) console.warn("[sms/send] Supabase check existing:", existingError.message);
  if (existing) {
    console.log("[sms/send] Numéro déjà vérifié");
    return NextResponse.json({ error: "already_verified" }, { status: 409 });
  }

  // Banni ?
  const { data: banned, error: bannedError } = await sb
    .from("banned_phones")
    .select("ban_type, banned_until")
    .eq("phone", phone)
    .maybeSingle();

  if (bannedError) console.warn("[sms/send] Supabase check banned:", bannedError.message);
  if (banned) {
    const isBanned =
      banned.ban_type === "permanent" ||
      (banned.ban_type === "24h" &&
        banned.banned_until &&
        new Date(banned.banned_until) > new Date());
    if (isBanned) {
      console.log("[sms/send] Numéro banni —", banned.ban_type);
      return NextResponse.json({ error: "banned" }, { status: 403 });
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await sb.from("sms_codes").delete().eq("phone", phone);

  const { error: insertError } = await sb.from("sms_codes").insert({
    phone,
    code,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[sms/send] Supabase insert sms_codes:", insertError.message, insertError.code);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  console.log("[sms/send] Code OTP stocké, envoi SMS…");

  try {
    await sendOvhSMS(phone, `StrangerKiss — votre code : ${code}`);
  } catch (err) {
    console.error("[sms/send] Échec OVH SMS:", err);
    return NextResponse.json({ error: "sms_failed" }, { status: 500 });
  }

  console.log("[sms/send] ✓ SMS envoyé avec succès");
  return NextResponse.json({ ok: true });
}
