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

  if (!sid || !token || !from) throw new Error("Twilio not configured");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Twilio error");
  }
}

// POST /api/sms/send  { phone }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = (body.phone as string)?.trim();

  if (!phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }

  // Déjà vérifié ?
  const { data: existing } = await sb
    .from("users")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_verified" }, { status: 409 });
  }

  // Banni ?
  const { data: banned } = await sb
    .from("banned_phones")
    .select("ban_type, banned_until")
    .eq("phone", phone)
    .maybeSingle();

  if (banned) {
    const isBanned =
      banned.ban_type === "permanent" ||
      (banned.ban_type === "24h" &&
        banned.banned_until &&
        new Date(banned.banned_until) > new Date());
    if (isBanned) {
      return NextResponse.json({ error: "banned" }, { status: 403 });
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Supprimer les anciens codes pour ce numéro
  await sb.from("sms_codes").delete().eq("phone", phone);

  // Stocker le nouveau code
  const { error: insertError } = await sb.from("sms_codes").insert({
    phone,
    code,
    expires_at: expiresAt,
  });

  if (insertError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Envoyer le SMS
  try {
    await sendTwilioSMS(phone, `StrangerKiss — votre code : ${code}`);
  } catch (err) {
    console.error("Twilio send error:", err);
    return NextResponse.json({ error: "sms_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
