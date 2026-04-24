import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Vérifie que la requête vient d'un admin via token de session.
 *  Le client envoie X-Admin-Token dans les headers.
 *  Le token est vérifié contre la table admin_sessions (expiration 24h).
 */
export async function verifyAdmin(
  req: Request
): Promise<{ ok: boolean; phone: string | null }> {
  const token = req.headers.get("X-Admin-Token")?.trim() ?? null;
  if (!token) return { ok: false, phone: null };

  const { data } = await sb
    .from("admin_sessions")
    .select("token, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) return { ok: false, phone: null };

  if (new Date(data.expires_at) < new Date()) {
    await sb.from("admin_sessions").delete().eq("token", token);
    return { ok: false, phone: null };
  }

  return { ok: true, phone: null };
}

export { sb as adminSb };
