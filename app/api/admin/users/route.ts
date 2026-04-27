import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/users?q=phone&phone_only=true&limit=50&offset=0
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const phoneOnly = sp.get("phone_only") === "true";
  const limit = Math.min(parseInt(sp.get("limit") ?? "50"), 100);
  const offset = parseInt(sp.get("offset") ?? "0");

  let query = adminSb
    .from("users")
    .select("id, phone, credits, ref_code, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) query = query.ilike("phone", `%${q}%`);
  if (phoneOnly) query = query.not("phone", "is", null);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (data ?? []).map(u => u.id);
  const lastSeenMap: Record<string, string | null> = {};
  const blockCountMap: Record<string, number> = {};

  if (userIds.length > 0) {
    const { data: pinData } = await adminSb
      .from("user_pins")
      .select("id, user_id, last_seen")
      .in("user_id", userIds);

    const pinUserMap: Record<string, string> = {};
    for (const p of pinData ?? []) {
      pinUserMap[p.id] = p.user_id;
      if (!lastSeenMap[p.user_id] || (p.last_seen && p.last_seen > (lastSeenMap[p.user_id] ?? ""))) {
        lastSeenMap[p.user_id] = p.last_seen;
      }
    }

    const pinIds = Object.keys(pinUserMap);
    if (pinIds.length > 0) {
      const { data: blockData } = await adminSb
        .from("blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.in.(${pinIds.join(",")}),blocked_id.in.(${pinIds.join(",")})`);

      for (const b of blockData ?? []) {
        const u1 = pinUserMap[b.blocker_id];
        const u2 = pinUserMap[b.blocked_id];
        if (u1) blockCountMap[u1] = (blockCountMap[u1] ?? 0) + 1;
        if (u2) blockCountMap[u2] = (blockCountMap[u2] ?? 0) + 1;
      }
    }
  }

  const users = (data ?? []).map(u => ({
    ...u,
    last_seen: lastSeenMap[u.id] ?? null,
    block_count: blockCountMap[u.id] ?? 0,
  }));

  return NextResponse.json({ users, total: count });
}

// POST /api/admin/users  action: "add_credits" | "ban" | "unban"
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { action, phone, amount, ban_type, reason } = await req.json();

  if (action === "add_credits") {
    const { data: user } = await adminSb
      .from("users").select("id").eq("phone", phone).maybeSingle();
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    await adminSb.rpc("add_credits", { p_user_id: user.id, p_amount: amount });
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

  if (action === "unban") {
    await adminSb.from("banned_phones").delete().eq("phone", phone);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_user") {
    const { data: user } = await adminSb.from("users").select("id").eq("phone", phone).maybeSingle();
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    await adminSb.from("users").delete().eq("id", user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
