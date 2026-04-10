import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/waitlist?format=json|csv
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const format = new URL(req.url).searchParams.get("format") ?? "json";

  const { data, error } = await adminSb
    .from("waitlist")
    .select("id, phone, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Récupérer les numéros ayant un compte (convertis)
  const phones = (data ?? []).map((r) => r.phone);
  const { data: converted } = await adminSb
    .from("users")
    .select("phone")
    .in("phone", phones);
  const convertedPhones = new Set((converted ?? []).map((u) => u.phone));

  const rows = (data ?? []).map((r) => ({
    ...r,
    status: convertedPhones.has(r.phone) ? "converti" : "en attente",
  }));

  if (format === "csv") {
    const csv = [
      "phone,status,created_at",
      ...rows.map((r) => `${r.phone},${r.status},${r.created_at}`),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ waitlist: rows, total: rows.length });
}
