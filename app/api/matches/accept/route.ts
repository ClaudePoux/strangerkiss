import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyAdmin } from "@/lib/resend";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Appelé quand le destinataire accepte une demande de rencontre.
// 1. Met à jour match_requests → status = 'accepted'
// 2. Déduit 1 crédit du demandeur (via RPC spend_credit)
export async function POST(req: NextRequest) {
  const { requester_id, target_id } = await req.json();

  if (!requester_id || !target_id) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, credited: false });
  }

  // 1. Marquer la demande comme acceptée
  const { error: updateError } = await sb
    .from("match_requests")
    .update({ status: "accepted" })
    .eq("requester_id", requester_id)
    .eq("target_id", target_id)
    .eq("status", "pending");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // 2. Retrouver le user_id du demandeur (peut être null si pas de compte)
  const { data: pin } = await sb
    .from("user_pins")
    .select("user_id")
    .eq("id", requester_id)
    .single();

  if (!pin?.user_id) {
    return NextResponse.json({ ok: true, credited: false });
  }

  // 3. Déduire 1 crédit de façon atomique via la RPC spend_credit
  const { data: remaining, error: creditError } = await sb
    .rpc("spend_credit", { p_user_id: pin.user_id });

  if (creditError) {
    if (creditError.message.includes("insufficient_credits")) {
      return NextResponse.json({ error: "Crédits insuffisants" }, { status: 402 });
    }
    return NextResponse.json({ error: creditError.message }, { status: 500 });
  }

  // 4. Marquer le crédit comme dépensé
  await sb
    .from("match_requests")
    .update({ credit_spent: true })
    .eq("requester_id", requester_id)
    .eq("target_id", target_id);

  // 5. Enregistrer la rencontre dans la table encounters
  try {
    const [p1Res, p2Res] = await Promise.all([
      sb.from("user_pins").select("name, age, nationality, user_id, lat, lng").eq("id", requester_id).single(),
      sb.from("user_pins").select("name, age, nationality, user_id").eq("id", target_id).single(),
    ]);
    const p1 = p1Res.data;
    const p2 = p2Res.data;

    let phone1: string | null = null;
    let phone2: string | null = null;
    if (p1?.user_id) {
      const { data: u } = await sb.from("users").select("phone").eq("id", p1.user_id).single();
      phone1 = u?.phone ?? null;
    }
    if (p2?.user_id) {
      const { data: u } = await sb.from("users").select("phone").eq("id", p2.user_id).single();
      phone2 = u?.phone ?? null;
    }

    await sb.from("encounters").insert({
      user1_id: requester_id,
      user1_pseudo: p1?.name ?? null,
      user1_age: p1?.age ?? null,
      user1_nationality: p1?.nationality ?? null,
      user1_phone: phone1,
      user2_id: target_id,
      user2_pseudo: p2?.name ?? null,
      user2_age: p2?.age ?? null,
      user2_nationality: p2?.nationality ?? null,
      user2_phone: phone2,
      lat: p1?.lat ?? null,
      lng: p1?.lng ?? null,
    });
  } catch { /* ignore — table peut ne pas exister encore */ }

  notifyAdmin({
    subject: "💞 Nouvelle rencontre acceptée StrangerKiss",
    title: "💞 Rencontre acceptée",
    rows: [
      ["Demandeur (pin)", requester_id.slice(0, 8) + "…"],
      ["Destinataire (pin)", target_id.slice(0, 8) + "…"],
      ["Crédit déduit", "1"],
      ["Crédits restants", String(remaining ?? "—")],
    ],
  });

  return NextResponse.json({ ok: true, credited: true, credits_remaining: remaining });
}
