import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserPin } from "@/lib/supabase";

// Route serveur : utilise service_role pour bypasser RLS (nécessaire pour UPDATE)
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/db/pins?lat=&lng=&radius=5
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radiusKm = parseFloat(searchParams.get("radius") ?? "5");
  // 1° de latitude ≈ 111 km (constant)
  // 1° de longitude ≈ 111 km × cos(lat) — compense la compression aux hautes latitudes
  const deltaLat = radiusKm / 111;
  const deltaLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("user_pins")
    .select("*")
    .gte("lat", lat - deltaLat)
    .lte("lat", lat + deltaLat)
    .gte("lng", lng - deltaLng)
    .lte("lng", lng + deltaLng)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ pins: [] });
  return NextResponse.json({ pins: data as UserPin[] });
}

// POST /api/db/pins — upsert du profil sur la carte (un seul profil actif par device)
// Si pin_id est fourni, on met à jour le pin existant (updated_at rafraîchi).
// Sinon, on insère un nouveau pin.
// Si user_id absent, crée un utilisateur anonyme (3 crédits) et retourne son id.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pin_id, name, age, gender, nationality, bio, appearance, looking_for, lat, lng, user_id } = body;

  if (!name || !age || !gender || !looking_for || lat == null || lng == null) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  // Créer un utilisateur anonyme si aucun user_id fourni
  let resolvedUserId: string | null = user_id ?? null;
  if (!resolvedUserId) {
    const { data: newUser } = await sb
      .from("users")
      .insert({ credits: 3 })
      .select("id")
      .single();
    if (newUser) resolvedUserId = newUser.id;
  }

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
    // Rafraîchir created_at pour réinitialiser le timer d'expiration 24h
    created_at: new Date().toISOString(),
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pin: data as UserPin, user_id: resolvedUserId });
}
