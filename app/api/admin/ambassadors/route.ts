import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";

// GET /api/admin/ambassadors — liste complète (actifs + inactifs)
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await adminSb
    .from("ambassadors")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ambassadors: data ?? [] });
}

// POST /api/admin/ambassadors — créer un ambassadeur
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, brand, website, social_links, description, why_support,
    photo_url, referral_code, category, display_order, active, partner_since,
  } = body;

  if (!name || !description) {
    return NextResponse.json({ error: "name et description obligatoires" }, { status: 400 });
  }

  const { data, error } = await adminSb
    .from("ambassadors")
    .insert({
      name, brand, website,
      social_links: social_links ?? {},
      description, why_support,
      photo_url, referral_code,
      category: category ?? "Lifestyle",
      display_order: display_order ?? 0,
      active: active ?? true,
      partner_since: partner_since ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ambassador: data });
}
