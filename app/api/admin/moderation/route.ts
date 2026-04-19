import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/moderation
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [reportsRes, bansRes] = await Promise.all([
    adminSb
      .from("reports")
      .select("reporter_pin_id, reported_pin_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    adminSb
      .from("banned_phones")
      .select("id, phone, ban_type, banned_until, reason, created_at")
      .order("created_at", { ascending: false }),
  ]);

  // Compter les signalements par numéro signalé (via user_pins → users)
  const { data: reportCounts } = await adminSb
    .from("reports")
    .select("reported_pin_id, count:id.count()")
    .select("reported_pin_id");

  return NextResponse.json({
    reports: reportsRes.data ?? [],
    bans: bansRes.data ?? [],
  });
}

// POST /api/admin/moderation  action: "unban" | "ban"
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { action, phone, ban_type, reason } = await req.json();

  if (action === "unban") {
    await adminSb.from("banned_phones").delete().eq("phone", phone);
    return NextResponse.json({ ok: true });
  }

  if (action === "ban") {
    const banned_until = ban_type === "24h"
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;
    await adminSb.from("banned_phones").upsert(
      { phone, ban_type: ban_type ?? "permanent", banned_until, reason },
      { onConflict: "phone" }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_blocks") {
    const { data, error } = await adminSb
      .from("blocks")
      .delete()
      .not("blocker_id", "is", null)
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deleted: data?.length ?? 0 });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
