import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/users/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  // User de base
  const { data: user, error } = await adminSb
    .from("users")
    .select("id, phone, credits, ref_code, created_at")
    .eq("id", id)
    .single();

  if (error || !user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  // Pins de cet utilisateur (pour last_seen et les pin IDs)
  const { data: pins } = await adminSb
    .from("user_pins")
    .select("id, name, age, last_seen")
    .eq("user_id", id)
    .order("last_seen", { ascending: false });

  const lastSeen = pins?.[0]?.last_seen ?? null;
  const pinIds = (pins ?? []).map((p) => p.id);

  // Signalements reçus (où l'un des pins de cet utilisateur est signalé)
  const { count: reportsCount } = pinIds.length > 0
    ? await adminSb
        .from("reports")
        .select("id", { count: "exact", head: true })
        .in("reported_pin_id", pinIds)
    : { count: 0 };

  // Rencontres (table encounters si elle existe)
  let encountersCount = 0;
  try {
    const { count } = await adminSb
      .from("encounters")
      .select("id", { count: "exact", head: true })
      .or(`user1_id.eq.${id},user2_id.eq.${id}`);
    encountersCount = count ?? 0;
  } catch { /* table peut ne pas exister encore */ }

  // Statut de bannissement
  const { data: ban } = user.phone
    ? await adminSb
        .from("banned_phones")
        .select("ban_type, banned_until, reason, created_at")
        .eq("phone", user.phone)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    user,
    last_seen: lastSeen,
    pins: pins ?? [],
    reports_count: reportsCount ?? 0,
    encounters_count: encountersCount,
    ban: ban ?? null,
  });
}
