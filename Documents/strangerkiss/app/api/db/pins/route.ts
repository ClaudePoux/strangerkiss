import { NextRequest, NextResponse } from "next/server";
import { pool, mysqlReady } from "@/lib/mysql";
import type { UserPin } from "@/lib/supabase";

// GET /api/db/pins?lat=&lng=&radius=5
export async function GET(req: NextRequest) {
  if (!mysqlReady) return NextResponse.json({ pins: [] });

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radiusKm = parseFloat(searchParams.get("radius") ?? "5");
  const delta = radiusKm / 111;

  const [rows] = await pool.execute(
    `SELECT * FROM user_pins
     WHERE lat BETWEEN ? AND ?
       AND lng BETWEEN ? AND ?
       AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
     ORDER BY created_at DESC
     LIMIT 50`,
    [lat - delta, lat + delta, lng - delta, lng + delta]
  );

  return NextResponse.json({ pins: rows as UserPin[] });
}

// POST /api/db/pins  — upsert du profil sur la carte
export async function POST(req: NextRequest) {
  if (!mysqlReady) return NextResponse.json({ pin: null });

  const body = await req.json();
  const { name, age, gender, nationality, bio, appearance, looking_for, lat, lng, user_id } = body;

  if (!name || !age || !gender || !looking_for || lat == null || lng == null) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  await pool.execute(
    `INSERT INTO user_pins
      (id, user_id, name, age, gender, nationality, bio, appearance, looking_for, lat, lng, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      user_id ?? null,
      name,
      age,
      gender,
      nationality ?? "",
      bio ?? "",
      appearance ?? "",
      looking_for,
      lat,
      lng,
      now,
    ]
  );

  const pin: UserPin = {
    id, user_id, name, age, gender, nationality: nationality ?? "",
    bio: bio ?? "", appearance: appearance ?? "", looking_for, lat, lng,
    created_at: now,
  };

  return NextResponse.json({ pin });
}
