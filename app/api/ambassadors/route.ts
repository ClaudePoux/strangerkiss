import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const FALLBACK: never[] = [];

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ambassadors: FALLBACK });

  const sb = createClient(url, key);
  const category = new URL(req.url).searchParams.get("category");

  let query = sb
    .from("ambassadors")
    .select("id,name,brand,website,social_links,description,photo_url,referral_code,category,display_order,partner_since")
    .eq("active", true)
    .order("display_order", { ascending: true });

  if (category && category !== "all") query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ ambassadors: FALLBACK });
  return NextResponse.json({ ambassadors: data ?? FALLBACK });
}
