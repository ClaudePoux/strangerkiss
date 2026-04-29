import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/moderation
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [reportsRes, bansRes, blocksRes] = await Promise.all([
    adminSb
      .from("reports")
      .select("reporter_pin_id, reported_pin_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    adminSb
      .from("banned_phones")
      .select("id, phone, ban_type, banned_until, reason, created_at")
      .order("created_at", { ascending: false }),
    adminSb
      .from("blocks")
      .select("id, blocker_id, blocked_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Enrichissement des blocks ET reports avec pseudo/téléphone masqué
  // Un seul batch de requêtes pour les deux sections.
  const rawBlocks  = blocksRes.data ?? [];
  const rawReports = reportsRes.data ?? [];

  const allPinIds = [...new Set([
    ...rawBlocks.flatMap((b) => [b.blocker_id, b.blocked_id]),
    ...rawReports.flatMap((r) => [r.reporter_pin_id, r.reported_pin_id]),
  ].filter(Boolean))];

  let blocksEnriched  = rawBlocks.map((b) => ({ ...b, blocker: null as null | object, blocked: null as null | object }));
  let reportsEnriched = rawReports.map((r) => ({ ...r, reporter_name: "—", reporter_phone: "—", reported_name: "—", reported_phone: "—" }));

  if (allPinIds.length > 0) {
    const { data: pinRows } = await adminSb
      .from("user_pins")
      .select("id, name, age, nationality, user_id")
      .in("id", allPinIds);

    const userIds = [...new Set((pinRows ?? []).map((p) => p.user_id).filter(Boolean))];
    let phoneMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: userRows } = await adminSb.from("users").select("id, phone").in("id", userIds);
      phoneMap = Object.fromEntries((userRows ?? []).map((u) => [u.id, u.phone ?? ""]));
    }
    const pinMap = Object.fromEntries((pinRows ?? []).map((p) => [p.id, p]));

    function maskPhone(phone: string): string {
      if (!phone) return "—";
      return phone.slice(0, 4) + "***" + phone.slice(-3);
    }
    function pinInfo(pinId: string) {
      const p = pinMap[pinId];
      if (!p) return { name: "—", age: null, nationality: null, phone: "—" };
      return { name: p.name ?? "—", age: p.age ?? null, nationality: p.nationality ?? null, phone: maskPhone(phoneMap[p.user_id] ?? "") };
    }

    blocksEnriched = rawBlocks.map((b) => ({
      ...b,
      blocker: pinInfo(b.blocker_id),
      blocked: pinInfo(b.blocked_id),
    }));

    reportsEnriched = rawReports.map((r) => {
      const reporter = pinInfo(r.reporter_pin_id);
      const reported = pinInfo(r.reported_pin_id);
      return {
        ...r,
        reporter_name:  reporter.name,
        reporter_phone: reporter.phone,
        reported_name:  reported.name,
        reported_phone: reported.phone,
      };
    });
  }

  return NextResponse.json({
    reports: reportsEnriched,
    bans: bansRes.data ?? [],
    blocks: blocksEnriched,
  });
}

// POST /api/admin/moderation  action: "unban" | "ban"
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, phone, ban_type, reason } = body;

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

  if (action === "unblock") {
    const { blocker_id, blocked_id } = body as { blocker_id: string; blocked_id: string };
    await adminSb.from("blocks").delete().eq("blocker_id", blocker_id).eq("blocked_id", blocked_id);
    // Déblocage symétrique
    await adminSb.from("blocks").delete().eq("blocker_id", blocked_id).eq("blocked_id", blocker_id);
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
