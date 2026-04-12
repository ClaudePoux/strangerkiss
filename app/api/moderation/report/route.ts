import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SK_WARNING = "§MODERATION_WARNING§";

// POST /api/moderation/report
// Body: { reporter_pin_id, reported_pin_id, reason? }
// Logique :
//   1er signal  → enregistré silencieusement
//   2ème signal (personne différente) → avertissement dans le chat
//   3ème signal → ban 24h
//   récidive après ban 24h expiré → ban définitif
export async function POST(req: NextRequest) {
  const { reporter_pin_id, reported_pin_id, reason } = await req.json();

  if (!reporter_pin_id || !reported_pin_id) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true, action: "none" });
  }

  // 1. Anti-abus : 1 seul signalement par couple (reporter, reported)
  const { data: existing } = await sb
    .from("reports")
    .select("id")
    .eq("reporter_pin_id", reporter_pin_id)
    .eq("reported_pin_id", reported_pin_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, action: "already_reported" });
  }

  // 2. Enregistrer le signalement
  await sb.from("reports").insert({ reporter_pin_id, reported_pin_id, reason: reason ?? null });

  // 2b. Blocage symétrique immédiat : les deux profils disparaissent mutuellement de la carte
  await sb.from("blocks").upsert(
    [
      { blocker_id: reporter_pin_id, blocked_id: reported_pin_id },
      { blocker_id: reported_pin_id, blocked_id: reporter_pin_id },
    ],
    { onConflict: "blocker_id,blocked_id" }
  );

  // 3. Compter les signalements uniques contre ce profil
  const { count } = await sb
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("reported_pin_id", reported_pin_id);

  const total = count ?? 0;

  // 4. Récupérer le numéro de téléphone du profil signalé (via user_id → users)
  const { data: pin } = await sb
    .from("user_pins")
    .select("user_id")
    .eq("id", reported_pin_id)
    .single();

  const phone = await getPhone(pin?.user_id);

  // 5. Appliquer la logique de modération
  if (total >= 3 && phone) {
    // Vérifier si déjà banni (ban 24h expiré = récidive → ban définitif)
    const { data: prevBan } = await sb
      .from("banned_phones")
      .select("ban_type, banned_until")
      .eq("phone", phone)
      .maybeSingle();

    const isRecidive =
      prevBan &&
      prevBan.ban_type === "24h" &&
      prevBan.banned_until &&
      new Date(prevBan.banned_until) < new Date();

    const ban_type = isRecidive ? "permanent" : "24h";
    const banned_until = ban_type === "24h"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    await sb.from("banned_phones").upsert(
      { phone, ban_type, banned_until, reason: `${total} signalements` },
      { onConflict: "phone" }
    );

    return NextResponse.json({ ok: true, action: ban_type === "permanent" ? "banned_permanent" : "banned_24h" });
  }

  if (total === 2 && phone) {
    // Envoyer un message d'avertissement dans le chat (du système vers le signalé)
    await sb.from("messages").insert({
      from_id: reported_pin_id, // message "système" visible uniquement par le signalé
      to_id: reported_pin_id,
      content: SK_WARNING,
    });

    return NextResponse.json({ ok: true, action: "warned" });
  }

  return NextResponse.json({ ok: true, action: "recorded" });
}

async function getPhone(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data } = await sb.from("users").select("phone").eq("id", userId).single();
  return data?.phone ?? null;
}
