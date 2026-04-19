import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: Record<string, unknown> = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL:      url  ? `${url.slice(0, 30)}…` : "MANQUANTE",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anon ? `${anon.slice(0, 12)}…` : "MANQUANTE",
      SUPABASE_SERVICE_ROLE_KEY:     svc  ? `${svc.slice(0, 12)}…`  : "MANQUANTE",
    },
  };

  if (!url || !svc) {
    result.verdict = "ERREUR : variables d'environnement manquantes sur Vercel";
    return NextResponse.json(result);
  }

  const sb = createClient(url, svc);

  // 1. Compter tous les pins (sans filtre géo ni date)
  const { count: totalCount, error: countErr } = await sb
    .from("user_pins")
    .select("*", { count: "exact", head: true });

  result.user_pins_total = countErr ? `ERREUR: ${countErr.message}` : totalCount;

  // 2. Pins récents (last_seen < 10 min)
  const cutoff10 = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount, error: recentErr } = await sb
    .from("user_pins")
    .select("*", { count: "exact", head: true })
    .gte("last_seen", cutoff10);

  result.user_pins_last_10min = recentErr
    ? `ERREUR (last_seen absent ?): ${recentErr.message}`
    : recentCount;

  // 3. Les 3 pins les plus récents (toutes dates)
  const { data: sample, error: sampleErr } = await sb
    .from("user_pins")
    .select("id, name, lat, lng, last_seen, created_at")
    .order("created_at", { ascending: false })
    .limit(3);

  result.user_pins_sample = sampleErr ? `ERREUR: ${sampleErr.message}` : sample;

  // 4. Test lecture avec clé anon (simule ce que ferait un client browser)
  if (anon) {
    const sbAnon = createClient(url, anon);
    const { data: anonData, error: anonErr } = await sbAnon
      .from("user_pins")
      .select("id")
      .limit(1);
    result.anon_read_test = anonErr
      ? `BLOQUÉ par RLS: ${anonErr.message}`
      : `OK (${anonData?.length ?? 0} ligne(s) retournée(s))`;
  }

  // 5. Vérifier que la colonne last_seen existe
  const { data: colCheck, error: colErr } = await sb
    .from("user_pins")
    .select("last_seen")
    .limit(1);

  result.column_last_seen = colErr
    ? `ABSENTE ou erreur: ${colErr.message}`
    : "présente";

  // Verdict global
  if (typeof result.user_pins_total === "number" && result.user_pins_total === 0) {
    result.verdict = "Table user_pins VIDE — aucun pin en base";
  } else if (typeof result.user_pins_last_10min === "number" && result.user_pins_last_10min === 0) {
    result.verdict = "Pins présents en base mais TOUS expirés (last_seen > 10min)";
  } else {
    result.verdict = "Base accessible et pins actifs présents";
  }

  return NextResponse.json(result, { status: 200 });
}
