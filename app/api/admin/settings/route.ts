import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// PATCH /api/admin/settings  { key: "launch_date", value: "2026-06-01T00:00:00Z" }
export async function PATCH(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { key, value } = await req.json();
  if (!key || !value) {
    return NextResponse.json({ error: "missing key or value" }, { status: 400 });
  }

  const { error } = await adminSb
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// GET /api/admin/settings?key=launch_date
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  const { data, error } = await adminSb
    .from("settings")
    .select("value, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ value: data?.value ?? null, updated_at: data?.updated_at ?? null });
}
