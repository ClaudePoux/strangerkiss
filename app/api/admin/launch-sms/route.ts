import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LAUNCH_MESSAGE =
  "StrangerKiss est live ! Vos 10 crédits vous attendent sur strangerkiss.com 💋";
const LAUNCH_CREDITS = 10;

function ovhSign(
  appSecret: string, consumerKey: string,
  method: string, url: string, body: string, timestamp: number
): string {
  const pre = [appSecret, consumerKey, method.toUpperCase(), url, body, timestamp].join("+");
  return "$1$" + createHash("sha1").update(pre).digest("hex");
}

async function sendOvhSMS(to: string, message: string): Promise<void> {
  const ak = process.env.OVH_APP_KEY!;
  const as = process.env.OVH_APP_SECRET!;
  const ck = process.env.OVH_CONSUMER_KEY!;
  const svc = process.env.OVH_SMS_SERVICE_NAME!;

  const url = `https://eu.api.ovh.com/1.0/sms/${svc}/jobs`;
  const bodyObj = { message, receivers: [to], sender: "StrangerKis" };
  const bodyStr = JSON.stringify(bodyObj);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = ovhSign(as, ck, "POST", url, bodyStr, timestamp);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "X-Ovh-Application": ak,
      "X-Ovh-Consumer":    ck,
      "X-Ovh-Timestamp":   String(timestamp),
      "X-Ovh-Signature":   signature,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const raw = await res.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }
    throw new Error(String(parsed.message ?? raw ?? `HTTP ${res.status}`));
  }
}

async function checkAdminToken(token: string): Promise<boolean> {
  const { data } = await sb
    .from("admin_sessions")
    .select("expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return false;
  return new Date(data.expires_at) > new Date();
}

// POST /api/admin/launch-sms
// Envoie un SMS de lancement à tous les numéros de la waitlist
// et attribue 10 crédits à chaque utilisateur correspondant.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token || !(await checkAdminToken(token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ak = process.env.OVH_APP_KEY;
  const as = process.env.OVH_APP_SECRET;
  const ck = process.env.OVH_CONSUMER_KEY;
  const svc = process.env.OVH_SMS_SERVICE_NAME;

  if (!ak || !as || !ck || !svc) {
    return NextResponse.json({ error: "OVH non configuré" }, { status: 500 });
  }

  // Récupérer tous les numéros de la waitlist
  const { data: waitlist, error: wErr } = await sb
    .from("waitlist")
    .select("phone")
    .order("created_at", { ascending: true });

  if (wErr) {
    return NextResponse.json({ error: `Supabase: ${wErr.message}` }, { status: 500 });
  }

  const phones = (waitlist ?? []).map((r) => r.phone as string).filter(Boolean);

  if (phones.length === 0) {
    return NextResponse.json({ ok: true, total: 0, sent: 0, credited: 0, errors: [] });
  }

  let sent = 0;
  let credited = 0;
  const errors: { phone: string; error: string }[] = [];

  for (const phone of phones) {
    // 1. Envoyer le SMS
    try {
      await sendOvhSMS(phone, LAUNCH_MESSAGE);
      sent++;
      console.log(`[launch-sms] ✓ SMS envoyé → ${phone.slice(0, 4)}****`);
    } catch (err) {
      const msg = String((err as Error).message ?? err);
      errors.push({ phone: phone.slice(0, 4) + "****", error: msg });
      console.error(`[launch-sms] ✗ Erreur SMS → ${phone.slice(0, 4)}**** : ${msg}`);
    }

    // 2. Attribuer 10 crédits à l'utilisateur correspondant (si compte existant)
    try {
      const { data: user } = await sb
        .from("users")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (user) {
        const { error: creditErr } = await sb.rpc("add_credits", {
          p_user_id: user.id,
          p_amount: LAUNCH_CREDITS,
        });
        if (!creditErr) {
          credited++;
          console.log(`[launch-sms] ✓ ${LAUNCH_CREDITS} crédits → ${phone.slice(0, 4)}****`);
        } else {
          console.warn(`[launch-sms] ✗ Crédits échoués → ${phone.slice(0, 4)}**** : ${creditErr.message}`);
        }
      }
    } catch (err) {
      console.warn(`[launch-sms] ✗ Exception crédits → ${phone.slice(0, 4)}**** :`, err);
    }

    // Pause de 100ms entre chaque SMS pour éviter le rate-limit OVH
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`[launch-sms] Terminé — total: ${phones.length}, envoyés: ${sent}, crédités: ${credited}, erreurs: ${errors.length}`);

  return NextResponse.json({
    ok: true,
    total: phones.length,
    sent,
    credited,
    errors,
  });
}
