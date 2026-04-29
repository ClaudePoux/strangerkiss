import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/users/init
// Crée un utilisateur anonyme (0 crédits) et retourne son id.
// Appelé depuis /verify quand aucun sk_user_id n'existe encore en session.
export async function POST() {
  const { data, error } = await sb
    .from("users")
    .insert({ credits: 0 })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user_id: data.id });
}
