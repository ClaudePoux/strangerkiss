import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateRefCode(): string {
  // 8 caractères alphanumérique majuscule
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Normalise un numéro de téléphone vers le format E.164.
 * - Supprime espaces, tirets, points, parenthèses
 * - Convertit le préfixe `00XX` en `+XX`
 * - Retourne une chaîne vide si le format est invalide
 */
function normalizePhone(p: string): string {
  let n = p.replace(/[\s\-().]/g, "");
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (!/^\+\d{7,15}$/.test(n)) return "";
  return n;
}

// POST /api/sms/verify  { phone, code, user_id, sponsor_ref? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // Normaliser le numéro pour garantir un format cohérent en base
  const phone = normalizePhone((body.phone as string)?.trim() ?? "");
  const code = (body.code as string)?.trim();
  const userId = body.user_id as string;
  const sponsorRef = (body.sponsor_ref as string | undefined)?.trim();

  if (!phone || !code || !userId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Récupérer le code OTP
  const { data: smsCode } = await sb
    .from("sms_codes")
    .select("code, expires_at")
    .eq("phone", phone)
    .maybeSingle();

  if (!smsCode) {
    return NextResponse.json({ error: "code_not_found" }, { status: 400 });
  }

  if (new Date(smsCode.expires_at) < new Date()) {
    await sb.from("sms_codes").delete().eq("phone", phone);
    return NextResponse.json({ error: "code_expired" }, { status: 400 });
  }

  if (smsCode.code !== code) {
    return NextResponse.json({ error: "code_invalid" }, { status: 400 });
  }

  // Vérifier que ce numéro n'est pas déjà lié à un autre compte
  const { data: existingUser } = await sb
    .from("users")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: "already_verified" }, { status: 409 });
  }

  // Pré-inscrit en waitlist → 7 crédits bonus, sinon 3
  const { data: waitlisted } = await sb
    .from("waitlist")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  // 6 crédits au total à la vérification (3 inscription + 3 vérification)
  // Waitlist : 10 crédits (bonus +4 maintenu)
  const bonusCredits = waitlisted ? 10 : 6;
  const refCode = generateRefCode();

  // Mettre à jour l'utilisateur : associer le numéro, générer ref_code
  const { error: updateError } = await sb
    .from("users")
    .update({ phone, ref_code: refCode })
    .eq("id", userId);

  if (updateError) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Ajouter les crédits bonus
  const { data: newCredits } = await sb.rpc("add_credits", {
    p_user_id: userId,
    p_amount: bonusCredits,
  });

  // Supprimer le code OTP utilisé
  await sb.from("sms_codes").delete().eq("phone", phone);

  // Traiter le parrainage
  if (sponsorRef) {
    const { data: sponsor } = await sb
      .from("users")
      .select("id")
      .eq("ref_code", sponsorRef)
      .maybeSingle();

    if (sponsor && sponsor.id !== userId) {
      // +5 crédits pour le parrain
      await sb.rpc("add_credits", { p_user_id: sponsor.id, p_amount: 5 });
      // Enregistrer le parrainage
      await sb.from("referrals").insert({
        referrer_user_id: sponsor.id,
        referred_user_id: userId,
      }).select().maybeSingle(); // ignoré si conflit (uq_referred)
    }
  }

  return NextResponse.json({
    ok: true,
    bonus_credits: bonusCredits,
    is_waitlisted: !!waitlisted,
    new_credits: newCredits,
    ref_code: refCode,
  });
}
