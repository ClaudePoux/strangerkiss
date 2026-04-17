import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/moderation/check-ban?phone=+33612345678
// Retourne { banned: true, ban_type, banned_until? } ou { banned: false }
export async function GET(req: NextRequest) {
  const phone = new URL(req.url).searchParams.get("phone");

  if (!phone || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ banned: false });
  }

  const { data } = await sb
    .from("banned_phones")
    .select("ban_type, banned_until")
    .eq("phone", phone)
    .maybeSingle();

  if (!data) return NextResponse.json({ banned: false });

  // Ban 24h expiré → plus banni
  if (data.ban_type === "24h" && data.banned_until && new Date(data.banned_until) < new Date()) {
    return NextResponse.json({ banned: false });
  }

  return NextResponse.json({
    banned: true,
    ban_type: data.ban_type,
    banned_until: data.banned_until ?? null,
  });
}
