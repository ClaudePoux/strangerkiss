import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/auth/login  { password }
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.BOSS_PASSWORD;

  if (!expected) {
    console.error("[admin/login] BOSS_PASSWORD non défini");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  if (!password || password !== expected) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
