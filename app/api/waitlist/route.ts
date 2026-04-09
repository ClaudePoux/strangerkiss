import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/waitlist → { count: number }
export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ count: 0 });
  }
  const { count } = await sb
    .from("waitlist")
    .select("*", { count: "exact", head: true });
  return NextResponse.json({ count: count ?? 0 });
}

// POST /api/waitlist  body: { phone }
// → { ok: true } | { error: "already_registered" } | { error: string }
export async function POST(req: NextRequest) {
  const { phone } = await req.json();

  if (!phone || typeof phone !== "string" || phone.trim().length < 6) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await sb
    .from("waitlist")
    .insert({ phone: phone.trim() });

  if (error) {
    if (error.code === "23505") {
      // Contrainte unique violée
      return NextResponse.json({ error: "already_registered" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
