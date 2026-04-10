import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendTwilioSMS(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  console.log("[sms/send] Twilio config check —", {
    sid_set: !!sid,
    sid_prefix: sid?.slice(0, 6),
    token_set: !!token,
    from,
    to,
  });

  if (!sid || !token || !from) {
    console.error("[sms/send] ERREUR : variables Twilio manquantes", {
      TWILIO_ACCOUNT_SID: !!sid,
      TWILIO_AUTH_TOKEN: !!token,
      TWILIO_PHONE_NUMBER: !!from,
    });
    throw new Error("Twilio not configured");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  console.log("[sms/send] POST →", url);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });

  console.log("[sms/send] Twilio HTTP status:", res.status);

  if (!res.ok) {
    const raw = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { /* non-JSON */ }
    console.error("[sms/send] Twilio erreur —", {
      status: res.status,
      code: parsed.code,
      message: parsed.message,
      more_info: parsed.more_info,
      raw: raw.slice(0, 500),
    });
    throw new Error(String(parsed.message ?? raw ?? "Twilio error"));
  }

  const result = await res.json();
  console.log("[sms/send] SMS envoyé —", {
    sid: result.sid,
    status: result.status,
    to: result.to,
  });
}

// POST /api/sms/send  { phone }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = (body.phone as string)?.trim();
  console.log("[sms/send] Demande reçue — phone:", phone ? phone.slice(0, 4) + "****" : "(vide)");

  if (!phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
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
    await sendTwilioSMS(phone, `StrangerKiss — votre code : ${code}`);
  } catch (err) {
    console.error("[sms/send] Échec Twilio:", err);
    return NextResponse.json({ error: "sms_failed" }, { status: 500 });
  }

  console.log("[sms/send] ✓ SMS envoyé avec succès");
  return NextResponse.json({ ok: true });
}
