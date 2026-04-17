import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Appelé quand le destinataire refuse une demande de rencontre.
// 1. Met à jour match_requests → status = 'refused'
// 2. Crée un blocage symétrique : les deux profils disparaissent mutuellement de la carte
export async function POST(req: NextRequest) {
  const { requester_id, target_id } = await req.json();

  if (!requester_id || !target_id) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  // 1. Marquer la demande comme refusée
  await sb
    .from("match_requests")
    .update({ status: "refused" })
    .eq("requester_id", requester_id)
    .eq("target_id", target_id);

  // 2. Blocage symétrique : chacun disparaît de la carte de l'autre
  const { error } = await sb.from("blocks").upsert(
    [
      { blocker_id: target_id, blocked_id: requester_id },
      { blocker_id: requester_id, blocked_id: target_id },
    ],
    { onConflict: "blocker_id,blocked_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
