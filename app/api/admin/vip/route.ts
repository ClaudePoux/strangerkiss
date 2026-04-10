import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/vip
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [watchesRes, alertsRes] = await Promise.all([
    adminSb.from("vip_watches").select("*").order("created_at", { ascending: false }),
    adminSb.from("vip_alerts").select("*").order("connected_at", { ascending: false }).limit(100),
  ]);

  return NextResponse.json({
    watches: watchesRes.data ?? [],
    alerts: alertsRes.data ?? [],
  });
}

// POST /api/admin/vip  { phone, reason? }
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { phone, reason } = await req.json();
  if (!phone) return NextResponse.json({ error: "phone_required" }, { status: 400 });

  const { error } = await adminSb
    .from("vip_watches")
    .insert({ phone: phone.trim(), reason: reason?.trim() ?? null });

  if (error?.code === "23505") return NextResponse.json({ error: "already_exists" }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/vip  { phone }
export async function DELETE(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { phone } = await req.json();
  await adminSb.from("vip_watches").delete().eq("phone", phone);
  return NextResponse.json({ ok: true });
}
