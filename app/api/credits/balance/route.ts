import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/credits/balance?user_id=
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return NextResponse.json({ credits: null });

  const { data } = await sb
    .from("users")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();

  return NextResponse.json({ credits: data?.credits ?? null });
}
