import { NextRequest, NextResponse } from "next/server";
import { adminSb } from "@/lib/admin-auth";
import { createHash } from "crypto";

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function ovhSign(as: string, ck: string, method: string, url: string, body: string, ts: number) {
  return "$1$" + createHash("sha1").update([as, ck, method, url, body, ts].join("+")).digest("hex");
}

async function sendSMS(to: string, message: string) {
  const ak = process.env.OVH_APP_KEY;
  const as = process.env.OVH_APP_SECRET;
  const ck = process.env.OVH_CONSUMER_KEY;
  const svc = process.env.OVH_SMS_SERVICE_NAME;
  if (!ak || !as || !ck || !svc) throw new Error("OVH not configured");
  const url = `https://eu.api.ovh.com/1.0/sms/${svc}/jobs`;
  const bodyStr = JSON.stringify({ message, receivers: [to], sender: "StrangerKis" });
  const ts = Math.floor(Date.now() / 1000);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Ovh-Application": ak,
      "X-Ovh-Consumer": ck,
      "X-Ovh-Timestamp": String(ts),
      "X-Ovh-Signature": ovhSign(as, ck, "POST", url, bodyStr, ts),
    },
    body: bodyStr,
  });
  if (!res.ok) throw new Error(await res.text());
}

// POST /api/admin/auth/send  { phone }
export async function POST(req: NextRequest) {
  const { phone } = await req.json().catch(() => ({}));
  if (!phone) return NextResponse.json({ error: "phone_required" }, { status: 400 });

  // Vérifier que le numéro est admin
  const { data: admin } = await adminSb
    .from("admins").select("id").eq("phone", phone).maybeSingle();
  if (!admin) return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const code = generateCode();
  await adminSb.from("sms_codes").delete().eq("phone", phone);
  await adminSb.from("sms_codes").insert({
    phone,
    code,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  try {
    await sendSMS(phone, `StrangerKiss Admin — code : ${code}`);
  } catch (err) {
    console.error("[admin/auth/send]", err);
    return NextResponse.json({ error: "sms_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
