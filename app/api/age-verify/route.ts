import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/age-verify
// Body: { user_id: string, birth_year: number }
// Enregistre la vérification d'âge dans la table users.
export async function POST(req: NextRequest) {
  const { user_id, birth_year } = await req.json();

  if (!user_id || !birth_year) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const { error } = await sb
    .from("users")
    .update({ age_verified: true, birth_year })
    .eq("id", user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
