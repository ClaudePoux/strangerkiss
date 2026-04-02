import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/twilio";
import { pool, mysqlReady } from "@/lib/mysql";
import type { User } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json();

  if (!phone || !code) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  let approved: boolean;
  try {
    approved = await verifyOtp(phone, code);
  } catch (err) {
    console.error("verify-otp error:", err);
    return NextResponse.json({ error: "Erreur de vérification" }, { status: 500 });
  }

  if (!approved) {
    return NextResponse.json({ error: "Code incorrect ou expiré" }, { status: 401 });
  }

  if (!mysqlReady) {
    return NextResponse.json({ error: "Base de données non configurée" }, { status: 500 });
  }

  // Récupérer l'utilisateur existant
  const [rows] = await pool.execute(
    `SELECT id, phone, credits,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
     FROM users WHERE phone = ?`,
    [phone]
  );
  const existing = (rows as User[])[0];

  if (existing) {
    return NextResponse.json({ user: existing });
  }

  // Créer un nouvel utilisateur avec 3 crédits offerts
  const id = crypto.randomUUID();
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");

  await pool.execute(
    `INSERT INTO users (id, phone, credits, created_at) VALUES (?, ?, 3, ?)`,
    [id, phone, now]
  );

  const user: User = { id, phone, credits: 3, created_at: now };
  return NextResponse.json({ user });
}
