import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/referral/info?user_id=
export async function GET(req: NextRequest) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "missing" }, { status: 400 });

  const { data: user } = await sb
    .from("users")
    .select("ref_code")
    .eq("id", userId)
    .maybeSingle();

  if (!user?.ref_code) {
    return NextResponse.json({ ref_code: null, count: 0, credits_earned: 0 });
  }

  const { count } = await sb
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", userId);

  return NextResponse.json({
    ref_code: user.ref_code,
    count: count ?? 0,
    credits_earned: (count ?? 0) * 5,
  });
}
