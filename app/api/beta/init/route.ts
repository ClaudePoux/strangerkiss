import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/beta/init — crée un utilisateur anonyme et retourne son id
// Utilisé par la page /beta avant la vérification SMS
export async function POST() {
  const { data, error } = await sb
    .from("users")
    .insert({ credits: 3 })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user_id: data.id });
}
