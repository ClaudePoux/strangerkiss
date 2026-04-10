import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/beta/check?phone=+33612345678
export async function GET(req: NextRequest) {
  const phone = new URL(req.url).searchParams.get("phone")?.trim();
  if (!phone) return NextResponse.json({ is_beta: false });

  const { data } = await sb
    .from("beta_testers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  return NextResponse.json({ is_beta: !!data });
}
