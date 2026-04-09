import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { UserPin } from "@/lib/supabase";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/db/pins?lat=&lng=&radius=5
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radiusKm = parseFloat(searchParams.get("radius") ?? "5");
  const delta = radiusKm / 111;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("user_pins")
    .select("*")
    .gte("lat", lat - delta)
    .lte("lat", lat + delta)
    .gte("lng", lng - delta)
    .lte("lng", lng + delta)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ pins: [] });
  return NextResponse.json({ pins: data as UserPin[] });
}

// POST /api/db/pins — upsert du profil sur la carte
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, age, gender, nationality, bio, appearance, looking_for, lat, lng, user_id } = body;

  if (!name || !age || !gender || !looking_for || lat == null || lng == null) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("user_pins")
    .insert({
      user_id: user_id ?? null,
      name,
      age,
      gender,
      nationality: nationality ?? "",
      bio: bio ?? "",
      appearance: appearance ?? "",
      looking_for,
      lat,
      lng,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pin: data as UserPin });
}
