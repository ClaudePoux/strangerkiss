import { NextRequest, NextResponse } from "next/server";
import { adminSb } from "@/lib/admin-auth";

// GET /api/legal/[slug]?lang=fr — public, no auth required
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const lang = _req.nextUrl.searchParams.get("lang") ?? "fr";
  const validLangs = ["fr", "en", "de", "it", "es", "ru", "zh", "ja"];
  const safeLang = validLangs.includes(lang) ? lang : "fr";

  // Select all content fields; pick the right one to avoid dynamic select type issues
  const { data, error } = await adminSb
    .from("legal_pages")
    .select("content_fr, content_en, content_de, content_it, content_es, content_ru, content_zh, content_ja, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ content: null });

  const key = `content_${safeLang}` as keyof typeof data;
  const content = data[key] as string | null;
  return NextResponse.json({ content: content || null, updated_at: data.updated_at });
}
