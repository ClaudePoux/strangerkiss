import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// PATCH /api/admin/ambassadors/[id] — modifier
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { error } = await adminSb
    .from("ambassadors")
    .update(body)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/ambassadors/[id] — supprimer
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await adminSb
    .from("ambassadors")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET /api/admin/ambassadors/[id] — nb de parrainages via referral_code
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: amb } = await adminSb
    .from("ambassadors")
    .select("referral_code")
    .eq("id", id)
    .maybeSingle();

  if (!amb?.referral_code) return NextResponse.json({ referral_count: 0 });

  const { count } = await adminSb
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("ref_code", amb.referral_code);

  return NextResponse.json({ referral_count: count ?? 0 });
}
