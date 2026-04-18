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
