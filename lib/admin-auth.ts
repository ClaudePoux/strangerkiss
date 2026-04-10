import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Vérifie que la requête vient d'un admin.
 *  Le client envoie X-Admin-Phone dans les headers.
 *  On vérifie que ce numéro est dans la table admins.
 */
export async function verifyAdmin(
  req: Request
): Promise<{ ok: boolean; phone: string | null }> {
  const phone = req.headers.get("X-Admin-Phone")?.trim() ?? null;
  if (!phone) return { ok: false, phone: null };

  const { data } = await sb
    .from("admins")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  return { ok: !!data, phone: data ? phone : null };
}

export { sb as adminSb };
