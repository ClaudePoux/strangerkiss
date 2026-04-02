import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Appelé quand le destinataire accepte une demande de rencontre.
// Déduit 1 crédit du demandeur (requester_pin_id → users.id).
export async function POST(req: NextRequest) {
  const { requester_pin_id } = await req.json();

  if (!requester_pin_id) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const db = adminSupabase();

  // Retrouver le user_id du demandeur via son pin
  const { data: pin, error: pinError } = await db
    .from("user_pins")
    .select("user_id")
    .eq("id", requester_pin_id)
    .single();

  if (pinError || !pin?.user_id) {
    // Pas de compte lié → pas de crédit à déduire (utilisateur non authentifié)
    return NextResponse.json({ ok: true, credited: false });
  }

  // Déduire 1 crédit via la fonction atomique
  const { error: rpcError } = await db.rpc("spend_credit", {
    p_user_id: pin.user_id,
  });

  if (rpcError) {
    if (rpcError.message?.includes("insufficient_credits")) {
      return NextResponse.json(
        { error: "Le demandeur n'a plus de crédits" },
        { status: 402 }
      );
    }
    console.error("spend_credit error:", rpcError);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credited: true });
}
