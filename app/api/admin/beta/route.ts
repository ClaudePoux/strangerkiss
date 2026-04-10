import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/beta
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await adminSb
    .from("beta_testers")
    .select("id, phone, name, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ beta_testers: data });
}

// POST /api/admin/beta  { phone, name? }
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { phone, name } = await req.json();
  if (!phone) return NextResponse.json({ error: "phone_required" }, { status: 400 });

  const { error } = await adminSb
    .from("beta_testers")
    .insert({ phone: phone.trim(), name: name?.trim() ?? null });

  if (error?.code === "23505") return NextResponse.json({ error: "already_exists" }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/beta  { phone }
export async function DELETE(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { phone } = await req.json();
  await adminSb.from("beta_testers").delete().eq("phone", phone);
  return NextResponse.json({ ok: true });
}
