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

// GET /api/beta/check?phone=+33...&user_id=uuid
export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const phoneRaw  = url.searchParams.get("phone")?.trim() ?? null;
  const userId    = url.searchParams.get("user_id")?.trim() ?? null;
  const phone     = phoneRaw ? normalizePhone(phoneRaw) : null;

  console.log("[beta/check] reçu —",
    "phone_raw:", phoneRaw ? phoneRaw.slice(0, 4) + "****" : null,
    "| phone_norm:", phone ? phone.slice(0, 4) + "****" : null,
    "| user_id:", userId ? userId.slice(0, 8) + "…" : null
  );

  // Stratégie 1 : vérification directe par numéro (normalisé)
  if (phone) {
    const { data, error } = await sb
      .from("beta_testers")
      .select("id, phone")
      .eq("phone", phone)
      .maybeSingle();
    console.log("[beta/check] S1 beta_testers.eq(phone_norm) →", {
      queried: phone.slice(0, 4) + "****",
      found: !!data,
      phone_in_db: data?.phone ? data.phone.slice(0, 4) + "****" : null,
      error: error?.message ?? null,
    });
    if (data) return NextResponse.json({ is_beta: true });

    // S1b : essai avec le format brut si différent (ex. DB stocke avec espaces)
    if (phoneRaw && phoneRaw !== phone) {
      const { data: dataRaw, error: errRaw } = await sb
        .from("beta_testers")
        .select("id, phone")
        .eq("phone", phoneRaw)
        .maybeSingle();
      console.log("[beta/check] S1b beta_testers.eq(phone_raw) →", {
        queried: phoneRaw.slice(0, 4) + "****",
        found: !!dataRaw,
        error: errRaw?.message ?? null,
      });
      if (dataRaw) return NextResponse.json({ is_beta: true });
    }
  }

  // Stratégie 2 : fallback via user_id → chercher le phone en base
  if (userId) {
    const { data: user, error: userErr } = await sb
      .from("users")
      .select("phone")
      .eq("id", userId)
      .maybeSingle();
    const dbPhone = user?.phone ?? null;
    const dbPhoneNorm = dbPhone ? normalizePhone(dbPhone) : null;
    console.log("[beta/check] S2 users lookup →", {
      found: !!user,
      phone_in_db_raw: dbPhone ? dbPhone.slice(0, 4) + "****" : null,
      phone_in_db_norm: dbPhoneNorm ? dbPhoneNorm.slice(0, 4) + "****" : null,
      error: userErr?.message ?? null,
    });

    if (dbPhoneNorm) {
      const { data: beta, error: betaErr } = await sb
        .from("beta_testers")
        .select("id, phone")
        .eq("phone", dbPhoneNorm)
        .maybeSingle();
      console.log("[beta/check] S2b beta_testers.eq(db_phone_norm) →", {
        queried: dbPhoneNorm.slice(0, 4) + "****",
        found: !!beta,
        error: betaErr?.message ?? null,
      });
      if (beta) return NextResponse.json({ is_beta: true });

      // S2c : essai avec format brut de la DB si différent
      if (dbPhone !== dbPhoneNorm) {
        const { data: betaRaw } = await sb
          .from("beta_testers")
          .select("id, phone")
          .eq("phone", dbPhone)
          .maybeSingle();
        console.log("[beta/check] S2c beta_testers.eq(db_phone_raw) →", {
          queried: dbPhone!.slice(0, 4) + "****",
          found: !!betaRaw,
        });
        if (betaRaw) return NextResponse.json({ is_beta: true });
      }
    }
  }

  console.log("[beta/check] → is_beta: false (aucune stratégie ne correspond)");
  return NextResponse.json({ is_beta: false });
}
