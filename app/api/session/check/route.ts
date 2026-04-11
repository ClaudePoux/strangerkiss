import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Normalise un numéro : supprime espaces, tirets, points, parenthèses */
function normalizePhone(p: string): string {
  return p.replace(/[\s\-().]/g, "");
}

// GET /api/session/check?user_id=&phone=
// Vérifie qu'un user_id existe en base et, si phone fourni, qu'il correspond.
// Réponse rapide — pas de données sensibles retournées.
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const userId   = sp.get("user_id")?.trim();
  const phoneRaw = sp.get("phone")?.trim();
  const phone    = phoneRaw ? normalizePhone(phoneRaw) : null;

  if (!userId) return NextResponse.json({ valid: false });

  const { data } = await sb
    .from("users")
    .select("id, phone, credits, ref_code")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return NextResponse.json({ valid: false });

  // Si un phone est fourni, vérifier la cohérence (comparaison normalisée)
  if (phone && data.phone) {
    const dbPhoneNorm = normalizePhone(data.phone);
    if (dbPhoneNorm !== phone) {
      console.warn("[session/check] phone mismatch — stored_norm:", dbPhoneNorm.slice(0, 4) + "****", "| provided_norm:", phone.slice(0, 4) + "****");
      return NextResponse.json({ valid: false });
    }
  }

  return NextResponse.json({
    valid: true,
    credits: data.credits,
    phone_verified: !!data.phone,
    ref_code: data.ref_code,
  });
}
