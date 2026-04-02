import { NextRequest, NextResponse } from "next/server";
import { verifyOtp } from "@/lib/twilio";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@/lib/supabase";

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

  const db = adminSupabase();

  // Récupérer ou créer l'utilisateur
  const { data: existing } = await db
    .from("users")
    .select("*")
    .eq("phone", phone)
    .single();

  if (existing) {
    return NextResponse.json({ user: existing as User });
  }

  const { data: created, error } = await db
    .from("users")
    .insert({ phone, credits: 3 })
    .select()
    .single();

  if (error) {
    console.error("create user error:", error);
    return NextResponse.json({ error: "Erreur création compte" }, { status: 500 });
  }

  return NextResponse.json({ user: created as User });
}
