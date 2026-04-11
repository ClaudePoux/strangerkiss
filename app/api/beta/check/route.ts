import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/beta/check?phone=+33...&user_id=uuid
export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const phone  = url.searchParams.get("phone")?.trim();
  const userId = url.searchParams.get("user_id")?.trim();

  console.log("[beta/check] reçu — phone:", phone ? phone.slice(0, 4) + "****" : null, "| user_id:", userId ? userId.slice(0, 8) + "…" : null);

  // Stratégie 1 : vérification directe par numéro
  if (phone) {
    const { data, error } = await sb
      .from("beta_testers")
      .select("id, phone")
      .eq("phone", phone)
      .maybeSingle();
    console.log("[beta/check] beta_testers.phone query →", { found: !!data, phone_in_db: data?.phone ?? null, error: error?.message ?? null });
    if (data) return NextResponse.json({ is_beta: true });
  }

  // Stratégie 2 : fallback via user_id
  if (userId) {
    const { data: user, error: userErr } = await sb
      .from("users")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    console.log("[beta/check] users lookup →", { found: !!user, phone_in_db: user?.phone ? user.phone.slice(0, 4) + "****" : null, error: userErr?.message ?? null });

    if (user?.phone) {
      const { data: beta, error: betaErr } = await sb
        .from("beta_testers")
        .select("id, phone")
        .eq("phone", user.phone)
        .maybeSingle();
      console.log("[beta/check] beta_testers.user_phone query →", { found: !!beta, phone_checked: user.phone.slice(0, 4) + "****", error: betaErr?.message ?? null });
      if (beta) return NextResponse.json({ is_beta: true });
    }
  }

  console.log("[beta/check] → is_beta: false");
  return NextResponse.json({ is_beta: false });
}
