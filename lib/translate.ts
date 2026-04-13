// Language codes for Google Translate API (free endpoint)
const LANG_CODES: Record<string, string> = {
  fr: "fr",
  en: "en",
  de: "de",
  it: "it",
  es: "es",
  ru: "ru",
  zh: "zh-CN",
  ja: "ja",
};

/**
 * Translates text into the target locale using the Google Translate client API.
 * Auto-detects the source language.
 */
export async function translateText(text: string, targetLocale: string): Promise<string> {
  const tl = LANG_CODES[targetLocale] ?? targetLocale;
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation request failed: ${res.status}`);

  const data = await res.json();
  // Response: [ [ ["translated_chunk", "original_chunk", ...], ... ], ..., "detected_source_lang", ... ]
  const chunks = data[0] as [string, string][];
  const translated = chunks.map(([t]) => t ?? "").join("");
  const detectedSource = data[2] as string | undefined;

  // If the detected source language matches the target, signal "already in this language"
  if (detectedSource && tl.startsWith(detectedSource)) {
    throw new AlreadyInTargetLanguageError();
  }

  return translated;
}

export class AlreadyInTargetLanguageError extends Error {
  constructor() {
    super("already_in_target_language");
  }
}

// Language codes for DeepL API
const DEEPL_LANG_CODES: Record<string, string> = {
  en: "EN",
  de: "DE",
  it: "IT",
  es: "ES",
  ru: "RU",
  zh: "ZH",
  ja: "JA",
};

/**
 * Translates text from French to the target locale using the DeepL API.
 * Requires DEEPL_API_KEY environment variable.
 * Free-tier keys end with ":fx" → uses api-free.deepl.com.
 */
export async function translateWithDeepL(text: string, targetLocale: string): Promise<string> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error("DEEPL_API_KEY not configured");

  const targetLang = DEEPL_LANG_CODES[targetLocale] ?? targetLocale.toUpperCase();
  const baseUrl = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text], target_lang: targetLang, source_lang: "FR" }),
  });

  if (!res.ok) throw new Error(`DeepL API error: ${res.status}`);
  const data = await res.json();
  return data.translations[0]?.text ?? "";
}
