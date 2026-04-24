import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Appelé quand le destinataire refuse une demande de rencontre.
// Marque uniquement match_requests → status = 'refused'.
// Aucun blocage : les profils restent visibles sur la carte et peuvent
// échanger de nouvelles demandes. Seul un signalement déclenche un masquage.
export async function POST(req: NextRequest) {
  const { requester_id, target_id } = await req.json();

  if (!requester_id || !target_id) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const { error } = await sb
    .from("match_requests")
    .update({ status: "refused" })
    .eq("requester_id", requester_id)
    .eq("target_id", target_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
