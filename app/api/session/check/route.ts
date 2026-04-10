import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/session/check?user_id=&phone=
// Vérifie qu'un user_id existe en base et, si phone fourni, qu'il correspond.
// Réponse rapide — pas de données sensibles retournées.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const userId = sp.get("user_id")?.trim();
  const phone  = sp.get("phone")?.trim();

  if (!userId) return NextResponse.json({ valid: false });

  const query = sb.from("users").select("id, phone, credits, ref_code").eq("id", userId);
  const { data } = await query.maybeSingle();

  if (!data) return NextResponse.json({ valid: false });

  // Si un phone est fourni, vérifier la cohérence
  if (phone && data.phone && data.phone !== phone) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({
    valid: true,
    credits: data.credits,
    phone_verified: !!data.phone,
    ref_code: data.ref_code,
  });
}
