import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

function periodStart(period: string): string {
  const now = new Date();
  switch (period) {
    case "day":   now.setHours(0, 0, 0, 0); break;
    case "week":  now.setDate(now.getDate() - 7); break;
    case "month": now.setMonth(now.getMonth() - 1); break;
    case "quarter": now.setMonth(now.getMonth() - 3); break;
    case "year":  now.setFullYear(now.getFullYear() - 1); break;
    default:      now.setDate(now.getDate() - 7);
  }
  return now.toISOString();
}

// GET /api/admin/stats?period=week
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const period = new URL(req.url).searchParams.get("period") ?? "week";
  const since = periodStart(period);

  const [
    usersTotal,
    usersPeriod,
    pinsActive,
    waitlistTotal,
    waitlistPeriod,
    referralsPeriod,
    reportsPeriod,
    bansTotal,
  ] = await Promise.all([
    adminSb.from("users").select("id", { count: "exact", head: true }).not("phone", "is", null),
    adminSb.from("users").select("id", { count: "exact", head: true }).gte("created_at", since).not("phone", "is", null),
    adminSb.from("user_pins").select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    adminSb.from("waitlist").select("id", { count: "exact", head: true }),
    adminSb.from("waitlist").select("id", { count: "exact", head: true }).gte("created_at", since),
    adminSb.from("referrals").select("id", { count: "exact", head: true }).gte("created_at", since),
    adminSb.from("reports").select("id", { count: "exact", head: true }).gte("created_at", since),
    adminSb.from("banned_phones").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    period,
    users_total: usersTotal.count ?? 0,
    users_period: usersPeriod.count ?? 0,
    pins_active_24h: pinsActive.count ?? 0,
    waitlist_total: waitlistTotal.count ?? 0,
    waitlist_period: waitlistPeriod.count ?? 0,
    referrals_period: referralsPeriod.count ?? 0,
    reports_period: reportsPeriod.count ?? 0,
    bans_total: bansTotal.count ?? 0,
  });
}
