import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/beta/check?phone=+33...&user_id=uuid
// Vérifie si l'utilisateur est dans beta_testers.
// Deux stratégies :
//   1. Par phone (sk_phone localStorage) — vérification directe
//   2. Par user_id (fallback si sk_phone absent ou format différent)
export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const phone  = url.searchParams.get("phone")?.trim();
  const userId = url.searchParams.get("user_id")?.trim();

  // Stratégie 1 : vérification directe par numéro
  if (phone) {
    const { data } = await sb
      .from("beta_testers")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (data) return NextResponse.json({ is_beta: true });
  }

  // Stratégie 2 : fallback via user_id → récupère le numéro en DB puis vérifie
  if (userId) {
    const { data: user } = await sb
      .from("users")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    if (user?.phone) {
      const { data: beta } = await sb
        .from("beta_testers")
        .select("id")
        .eq("phone", user.phone)
        .maybeSingle();
      if (beta) return NextResponse.json({ is_beta: true });
    }
  }

  return NextResponse.json({ is_beta: false });
}
