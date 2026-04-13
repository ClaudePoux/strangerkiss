import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, adminSb } from "@/lib/admin-auth";
import { translateWithDeepL } from "@/lib/translate";

const LANGS = ["en", "de", "it", "es", "ru", "zh", "ja"] as const;
const VALID_SLUGS = ["mentions-legales", "politique-de-confidentialite", "notre-histoire", "cgv"] as const;

// GET /api/admin/legal — list all 4 legal pages
export async function GET(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await adminSb
    .from("legal_pages")
    .select("slug, content_fr, content_en, content_de, content_it, content_es, content_ru, content_zh, content_ja, updated_at")
    .order("slug");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}

// POST /api/admin/legal — save French content + auto-translate all 7 other languages
export async function POST(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, content_fr } = await req.json();
  if (!VALID_SLUGS.includes(slug)) return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  if (typeof content_fr !== "string") return NextResponse.json({ error: "content_fr_required" }, { status: 400 });

  // Translate into 7 other languages (best-effort — errors logged but not fatal)
  const translations: Record<string, string> = {};
  for (const lang of LANGS) {
    try {
      translations[`content_${lang}`] = await translateWithDeepL(content_fr, lang);
    } catch (err) {
      console.error(`[legal/route] DeepL translation failed for ${lang}:`, err);
      translations[`content_${lang}`] = "";
    }
  }

  const { error } = await adminSb
    .from("legal_pages")
    .upsert(
      { slug, content_fr, ...translations, updated_at: new Date().toISOString() },
      { onConflict: "slug" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, translated: LANGS.filter(l => translations[`content_${l}`]) });
}

// PUT /api/admin/legal — manually save a single language override
export async function PUT(req: NextRequest) {
  const { ok } = await verifyAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug, lang, content } = await req.json();
  if (!VALID_SLUGS.includes(slug)) return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  const validLangs = ["fr", ...LANGS];
  if (!validLangs.includes(lang)) return NextResponse.json({ error: "invalid_lang" }, { status: 400 });

  const field = `content_${lang}`;
  const { error } = await adminSb
    .from("legal_pages")
    .upsert(
      { slug, [field]: content, updated_at: new Date().toISOString() },
      { onConflict: "slug" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
