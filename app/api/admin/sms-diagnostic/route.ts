import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function ovhSign(
  appSecret: string, consumerKey: string,
  method: string, url: string, body: string, timestamp: number
): string {
  const pre = [appSecret, consumerKey, method.toUpperCase(), url, body, timestamp].join("+");
  return "$1$" + createHash("sha1").update(pre).digest("hex");
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

// GET /api/admin/sms-diagnostic
// Vérifie la configuration OVH et teste la connectivité sans envoyer de SMS.
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? "";
  if (!token || !(await checkAdminToken(token))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ak = process.env.OVH_APP_KEY;
  const as = process.env.OVH_APP_SECRET;
  const ck = process.env.OVH_CONSUMER_KEY;
  const svc = process.env.OVH_SMS_SERVICE_NAME;

  const config = {
    OVH_APP_KEY:          ak ? `${ak.slice(0, 4)}…` : null,
    OVH_APP_SECRET:       as ? `${as.slice(0, 4)}…` : null,
    OVH_CONSUMER_KEY:     ck ? `${ck.slice(0, 4)}…` : null,
    OVH_SMS_SERVICE_NAME: svc ?? null,
  };

  const missing = Object.entries({ OVH_APP_KEY: ak, OVH_APP_SECRET: as, OVH_CONSUMER_KEY: ck, OVH_SMS_SERVICE_NAME: svc })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    return NextResponse.json({ ok: false, config, missing, connectivity: null });
  }

  // Test de connectivité : GET /sms/{svc}/jobs (liste des envois récents, lecture seule)
  const url = `https://eu.api.ovh.com/1.0/sms/${svc}/jobs`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = ovhSign(as!, ck!, "GET", url, "", timestamp);

  let connectivity: { status: number; ok: boolean; body: unknown; error?: string } | null = null;
  try {
    const res = await fetch(url, {
      headers: {
        "X-Ovh-Application": ak!,
        "X-Ovh-Consumer":    ck!,
        "X-Ovh-Timestamp":   String(timestamp),
        "X-Ovh-Signature":   signature,
      },
    });
    let body: unknown;
    try { body = await res.json(); } catch { body = null; }
    connectivity = { status: res.status, ok: res.ok, body };
  } catch (err) {
    connectivity = { status: 0, ok: false, body: null, error: String(err) };
  }

  // Compter les SMS en queue (si la requête a réussi)
  let smsCount: number | null = null;
  if (connectivity.ok && Array.isArray(connectivity.body)) {
    smsCount = (connectivity.body as unknown[]).length;
  }

  return NextResponse.json({
    ok: connectivity.ok,
    config,
    missing: [],
    connectivity,
    sms_queue_count: smsCount,
  });
}
