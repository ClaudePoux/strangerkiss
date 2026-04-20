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
  return NextResponse.json({ users: data, total: count });
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
