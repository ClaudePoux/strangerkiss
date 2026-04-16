import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? "fr";

  const { data, error } = await supabase
    .from("demo_pins")
    .select("id,name,age,gender,nationality,bio,appearance,looking_for")
    .eq("country", country);

  if (error) {
    return NextResponse.json({ pins: [] }, { status: 500 });
  }

  return NextResponse.json({ pins: data ?? [] });
}
