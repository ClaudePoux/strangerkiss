import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Vérifie que la requête vient d'un admin via mot de passe.
 *  Le client envoie X-Admin-Password dans les headers.
 *  Comparaison avec la variable d'environnement BOSS_PASSWORD.
 */
export async function verifyAdmin(
  req: Request
): Promise<{ ok: boolean; phone: string | null }> {
  const password = req.headers.get("X-Admin-Password")?.trim() ?? null;
  const expected = process.env.BOSS_PASSWORD;

  if (!expected || !password || password !== expected) {
    return { ok: false, phone: null };
  }

  return { ok: true, phone: null };
}

export { sb as adminSb };
