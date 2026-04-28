import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserPin } from "@/lib/supabase";
import { notifyAdmin, maskPhone } from "@/lib/resend";

// Route serveur : utilise service_role pour bypasser RLS (nécessaire pour UPDATE)
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkVip(userId: string) {
  const { data: user } = await sb.from("users").select("phone").eq("id", userId).maybeSingle();
  if (!user?.phone) return;
  const { data: watch } = await sb
    .from("vip_watches").select("id, reason").eq("phone", user.phone).maybeSingle();
  if (!watch) return;
  await sb.from("vip_alerts").insert({ watch_id: watch.id, phone: user.phone });
  console.log(`[VIP] Alerte — numéro surveillé connecté : ${user.phone.slice(0, 4)}****`);
  notifyAdmin({
    subject: "🔍 Connexion VIP surveillée — StrangerKiss",
    title: "🔍 Connexion d'un numéro surveillé",
    rows: [
      ["Téléphone", maskPhone(user.phone)],
      ["Motif de surveillance", watch.reason ?? "—"],
    ],
  });
}

// GET /api/db/pins?lat=&lng=&radius=5   — liste des pins actifs à proximité
// GET /api/db/pins?pin_id=xxx           — récupère un pin spécifique par son id
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Mode lookup par pin_id (pour résoudre le nom de l'expéditeur d'un message)
  const pinId = searchParams.get("pin_id");
  if (pinId) {
    const { data, error } = await sb
      .from("user_pins")
      .select("id, name, appearance, nationality, looking_for, age, gender")
      .eq("id", pinId)
      .maybeSingle();
    if (error) return NextResponse.json({ pin: null });
    return NextResponse.json({ pin: data });
  }

  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radiusKm = parseFloat(searchParams.get("radius") ?? "5");
  // 1° de latitude ≈ 111 km (constant)
  // 1° de longitude ≈ 111 km × cos(lat) — compense la compression aux hautes latitudes
  const deltaLat = radiusKm / 111;
  const deltaLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const activeCutoff  = new Date(Date.now() - 10 * 60 * 1000).toISOString();       // 10 min — filtre affichage
  const cleanupCutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();       // 20 min — suppression réelle
  const legacyCutoff  = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();  // 24h (fallback)

  // [DEBUG] — à supprimer après investigation
  console.log("[DEBUG GET /api/db/pins] params:", { lat, lng, radiusKm });
  console.log("[DEBUG GET /api/db/pins] bounding box:", {
    latMin: lat - deltaLat, latMax: lat + deltaLat,
    lngMin: lng - deltaLng, lngMax: lng + deltaLng,
  });
  console.log("[DEBUG GET /api/db/pins] activeCutoff:", activeCutoff);

  // Tentative 1 : filtre last_seen (colonne ajoutée en migration)
  const { data, error } = await sb
    .from("user_pins")
    .select("*")
    .gte("lat", lat - deltaLat)
    .lte("lat", lat + deltaLat)
    .gte("lng", lng - deltaLng)
    .lte("lng", lng + deltaLng)
    .gte("last_seen", activeCutoff)
    .order("last_seen", { ascending: false })
    .limit(50);

  // [DEBUG] — à supprimer après investigation
  console.log("[DEBUG GET /api/db/pins] résultat Supabase:", {
    count: data?.length ?? 0,
    error: error?.message ?? null,
    pins: data?.map(p => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, last_seen: p.last_seen })) ?? [],
  });

  if (error) {
    // Colonne last_seen absente ou autre erreur Supabase — fallback created_at
    console.warn("[GET /api/db/pins] Erreur last_seen, fallback created_at:", error.message);
    const { data: fallbackData, error: fallbackError } = await sb
      .from("user_pins")
      .select("*")
      .gte("lat", lat - deltaLat)
      .lte("lat", lat + deltaLat)
      .gte("lng", lng - deltaLng)
      .lte("lng", lng + deltaLng)
      .gte("created_at", legacyCutoff)
      .order("created_at", { ascending: false })
      .limit(50);

    if (fallbackError) {
      console.error("[GET /api/db/pins] Fallback échoué:", fallbackError.message);
      return NextResponse.json({ pins: [] });
    }
    return NextResponse.json({ pins: fallbackData as UserPin[] });
  }

  // Nettoyage silencieux des pins expirés (fire-and-forget, ne bloque pas la réponse)
  // Seuil 20 min — les pins entre 10 et 20 min sont déjà masqués par activeCutoff
  // mais restent en base pour survivre à une brève mise en veille de l'appareil.
  sb.from("user_pins")
    .delete()
    .lt("last_seen", cleanupCutoff)
    .then(({ error: delErr }) => {
      if (delErr) console.warn("[GET /api/db/pins] Cleanup échoué:", delErr.message);
    });

  return NextResponse.json({ pins: data as UserPin[] });
}

// POST /api/db/pins — upsert du profil sur la carte (un seul profil actif par device)
// Si pin_id est fourni, on met à jour le pin existant (last_seen rafraîchi).
// Sinon, on insère un nouveau pin.
// Si user_id absent, crée un utilisateur anonyme (3 crédits) et retourne son id.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pin_id, name, age, gender, nationality, bio, appearance, looking_for, lat, lng, user_id, birth_year } = body;

  if (!name || !age || !gender || !looking_for || lat == null || lng == null) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  // Validation birth_year pour les nouveaux comptes uniquement (user_id absent = première visite)
  if (!user_id) {
    const minBirthYear = new Date().getFullYear() - 18;
    if (!birth_year) {
      return NextResponse.json({ error: "birth_year_required" }, { status: 400 });
    }
    if (birth_year > minBirthYear) {
      return NextResponse.json({ error: "age_minimum_18" }, { status: 400 });
    }
  }

  // Créer un utilisateur anonyme si aucun user_id fourni
  let resolvedUserId: string | null = user_id ?? null;
  if (!resolvedUserId) {
    const { data: newUser } = await sb
      .from("users")
      .insert({ credits: 3, birth_year: birth_year ?? null })
      .select("id")
      .single();
    if (newUser) resolvedUserId = newUser.id;
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: resolvedUserId,
    name,
    age,
    gender,
    nationality: nationality ?? "",
    bio: bio ?? "",
    appearance: appearance ?? "",
    looking_for,
    lat,
    lng,
    created_at: now,
    last_seen: now,
  };

  let data, error;

  if (pin_id) {
    // Mise à jour du pin existant
    ({ data, error } = await sb
      .from("user_pins")
      .update(payload)
      .eq("id", pin_id)
      .select()
      .single());
    // PGRST116 = row not found (pin expiré ou supprimé) → on insère
    if (error?.code === "PGRST116" || (!data && !error)) {
      error = null;
      ({ data, error } = await sb
        .from("user_pins")
        .insert({ ...payload, id: pin_id })
        .select()
        .single());
      // Si INSERT avec l'ancien id échoue (conflit), INSERT sans id
      if (error) {
        ({ data, error } = await sb
          .from("user_pins")
          .insert(payload)
          .select()
          .single());
      }
    }
  } else {
    // Pas de pin_id connu : nouvelle insertion
    ({ data, error } = await sb
      .from("user_pins")
      .insert(payload)
      .select()
      .single());
  }

  if (error) {
    console.error("[POST /api/db/pins] ERREUR:", error.message, "| pin_id envoyé:", pin_id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Vérification VIP en arrière-plan (ne bloque pas la réponse)
  if (resolvedUserId) {
    checkVip(resolvedUserId).catch(() => {});
  }

  return NextResponse.json({ pin: data as UserPin, user_id: resolvedUserId });
}

// PATCH /api/db/pins — ping de présence (met à jour last_seen uniquement)
// Body: { pin_id: string }
export async function PATCH(req: NextRequest) {
  const { pin_id } = await req.json();
  if (!pin_id) return NextResponse.json({ error: "pin_id manquant" }, { status: 400 });

  const { error } = await sb
    .from("user_pins")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", pin_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
