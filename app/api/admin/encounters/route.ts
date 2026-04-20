import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/encounters?q=phone&from=ISO&to=ISO&limit=50&offset=0
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const from = sp.get("from");
  const to = sp.get("to");
  const limit = Math.min(parseInt(sp.get("limit") ?? "50"), 200);
  const offset = parseInt(sp.get("offset") ?? "0");

  let query = adminSb
    .from("encounters")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) query = query.or(`user1_phone.ilike.%${q}%,user2_phone.ilike.%${q}%,user1_pseudo.ilike.%${q}%,user2_pseudo.ilike.%${q}%`);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ encounters: data ?? [], total: count ?? 0 });
}
