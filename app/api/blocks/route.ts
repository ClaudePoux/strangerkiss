import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/blocks?pin_id=XXX
// Retourne la liste des pin_ids bloqués par ce profil.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pin_id = searchParams.get("pin_id");

  if (!pin_id || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ blocked: [] });
  }

  const { data, error } = await sb
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", pin_id);

  if (error) return NextResponse.json({ blocked: [] });
  return NextResponse.json({ blocked: (data ?? []).map((r) => r.blocked_id) });
}
