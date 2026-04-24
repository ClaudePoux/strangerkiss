import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const FALLBACK = "2026-05-26T00:00:00Z";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ date: FALLBACK });
  }

  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("settings")
    .select("value")
    .eq("key", "launch_date")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ date: FALLBACK });
  }

  return NextResponse.json({ date: data.value });
}
