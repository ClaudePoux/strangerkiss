import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// POST /api/admin/auth/login  { login, password }
export async function POST(req: NextRequest) {
  const { login, password } = await req.json().catch(() => ({}));

  const expectedLogin    = process.env.BOSS_LOGIN;
  const expectedPassword = process.env.BOSS_PASSWORD;

  if (!expectedLogin || !expectedPassword) {
    console.error("[admin/login] BOSS_LOGIN ou BOSS_PASSWORD non défini");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const ip = getClientIp(req);
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();

  // Compter les tentatives récentes pour cette IP
  const { count } = await sb
    .from("admin_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("attempted_at", windowStart);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    console.warn(`[admin/login] IP bloquée (${MAX_ATTEMPTS} tentatives) : ${ip}`);
    return NextResponse.json(
      { error: "too_many_attempts", retry_after_minutes: LOCKOUT_MINUTES },
      { status: 429 }
    );
  }

  // Vérifier les credentials
  if (!login || !password || login !== expectedLogin || password !== expectedPassword) {
    // Enregistrer la tentative échouée
    await sb.from("admin_attempts").insert({ ip });
    console.warn(`[admin/login] Échec de connexion depuis ${ip} (tentative ${(count ?? 0) + 1}/${MAX_ATTEMPTS})`);
    const remaining = MAX_ATTEMPTS - (count ?? 0) - 1;
    return NextResponse.json(
      { error: "invalid_credentials", attempts_remaining: remaining },
      { status: 401 }
    );
  }

  // Credentials valides → créer une session
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: sessionError } = await sb
    .from("admin_sessions")
    .insert({ token, expires_at: expiresAt });

  if (sessionError) {
    console.error("[admin/login] Erreur création session :", sessionError.message);
    return NextResponse.json({ error: "session_error" }, { status: 500 });
  }

  // Nettoyer les anciennes tentatives de cette IP après succès
  await sb.from("admin_attempts").delete().eq("ip", ip);

  console.log(`[admin/login] Connexion réussie depuis ${ip}`);
  return NextResponse.json({ ok: true, token, expires_at: expiresAt });
}
