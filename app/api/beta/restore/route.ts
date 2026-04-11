import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Normalise un numéro : supprime espaces, tirets, points, parenthèses */
function normalizePhone(p: string): string {
  return p.replace(/[\s\-().]/g, "");
}

// POST /api/beta/restore
// Si le numéro est dans beta_testers → trouve ou crée l'utilisateur avec ce numéro,
// sans renvoyer de SMS. Permet la reconnexion silencieuse des beta-testeurs.
// Body: { phone: string, user_id?: string }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const phoneRaw = (body.phone as string)?.trim();
  const user_id  = body.user_id as string | undefined;
  if (!phoneRaw) return NextResponse.json({ ok: false, error: "phone manquant" }, { status: 400 });

  const phone = normalizePhone(phoneRaw);
  console.log("[beta/restore] phone_raw:", phoneRaw.slice(0, 4) + "****", "| phone_norm:", phone.slice(0, 4) + "****");

  // Vérifier que ce numéro est bien dans beta_testers (essai normalisé puis brut)
  let beta = null;
  const { data: betaNorm } = await sb
    .from("beta_testers")
    .select("phone")
    .eq("phone", phone)
    .maybeSingle();
  beta = betaNorm;

  if (!beta && phoneRaw !== phone) {
    const { data: betaRaw } = await sb
      .from("beta_testers")
      .select("phone")
      .eq("phone", phoneRaw)
      .maybeSingle();
    beta = betaRaw;
  }

  console.log("[beta/restore] beta_testers check →", { found: !!beta });
  if (!beta) return NextResponse.json({ ok: false, error: "not_beta" }, { status: 403 });

  // Chercher l'utilisateur existant avec ce numéro (normalisé puis brut en fallback)
  let existing: { id: string; credits: number; ref_code: string } | null = null;
  const { data: existingNorm } = await sb
    .from("users")
    .select("id, credits, ref_code")
    .eq("phone", phone)
    .maybeSingle();
  existing = existingNorm;

  if (!existing && phoneRaw !== phone) {
    const { data: existingRaw } = await sb
      .from("users")
      .select("id, credits, ref_code")
      .eq("phone", phoneRaw)
      .maybeSingle();
    existing = existingRaw;
  }

  console.log("[beta/restore] users lookup →", { found: !!existing });

  if (existing) {
    // Utilisateur trouvé → retourner ses infos
    return NextResponse.json({
      ok: true,
      user_id: existing.id,
      credits: existing.credits,
      ref_code: existing.ref_code,
    });
  }

  // Pas d'utilisateur avec ce phone — essayer de rattacher au user_id anonyme si fourni
  if (user_id) {
    const { data: updated } = await sb
      .from("users")
      .update({ phone })
      .eq("id", user_id)
      .select("id, credits, ref_code")
      .single();

    if (updated) {
      return NextResponse.json({
        ok: true,
        user_id: updated.id,
        credits: updated.credits,
        ref_code: updated.ref_code,
      });
    }
  }

  // Créer un nouvel utilisateur vérifié
  const { data: newUser, error } = await sb
    .from("users")
    .insert({ phone, credits: 3 })
    .select("id, credits, ref_code")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    user_id: newUser.id,
    credits: newUser.credits,
    ref_code: newUser.ref_code,
  });
}
