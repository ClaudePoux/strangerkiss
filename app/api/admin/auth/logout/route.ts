import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/admin/auth/logout  — révoque le token de session
export async function POST(req: NextRequest) {
  const token = req.headers.get("X-Admin-Token")?.trim();
  if (token) {
    await sb.from("admin_sessions").delete().eq("token", token);
  }
  return NextResponse.json({ ok: true });
}
