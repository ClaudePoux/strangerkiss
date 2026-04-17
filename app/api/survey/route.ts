import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/survey
// Body: { user_id, travel_situation, discovery_channel }
export async function POST(req: NextRequest) {
  const { user_id, travel_situation, discovery_channel } = await req.json();

  if (!user_id) {
    return NextResponse.json({ error: "user_id manquant" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, persisted: false });
  }

  const { error } = await sb
    .from("users")
    .update({ survey_done: true, travel_situation, discovery_channel })
    .eq("id", user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
