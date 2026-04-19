"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import fr from "../locales/fr.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import it from "../locales/it.json";
import es from "../locales/es.json";
import ru from "../locales/ru.json";
import zh from "../locales/zh.json";
import ja from "../locales/ja.json";

export const LOCALES = ["fr", "en", "de", "it", "es", "ru", "zh", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  es: "Español",
  ru: "Русский",
  zh: "中文",
  ja: "日本語",
};

export const LOCALE_BCP47: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  de: "de-DE",
  it: "it-IT",
  es: "es-ES",
  ru: "ru-RU",
  zh: "zh-CN",
  ja: "ja-JP",
};

type Dict = Record<string, Record<string, string>>;

const DICTS: Record<Locale, Dict> = {
  fr, en, de, it, es, ru, zh, ja,
} as Record<Locale, Dict>;

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem("sk_locale") as Locale;
    if (stored && (LOCALES as readonly string[]).includes(stored)) return stored;
    const lang = navigator.language.split("-")[0] as Locale;
    if ((LOCALES as readonly string[]).includes(lang)) return lang;
  } catch {
    // SSR or storage unavailable
  }
  return "fr";
}

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  bcp47: string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    document.documentElement.lang = LOCALE_BCP47[locale].split("-")[0];
  }, [locale]);

  function setLocale(l: Locale) {
    setLocaleState(l);
    try {
      localStorage.setItem("sk_locale", l);
    } catch {}
  }

  function t(key: string, vars?: Record<string, string>): string {
    const dot = key.indexOf(".");
    const section = key.slice(0, dot);
    const k = key.slice(dot + 1);
    const sectionDict = DICTS[locale][section];
    let str = sectionDict?.[k] ?? key;
    if (vars) {
      for (const [v, val] of Object.entries(vars)) {
        str = str.replaceAll(`{${v}}`, val);
      }
    }
    return str;
  }

  return (
    <Ctx.Provider value={{ locale, setLocale, t, bcp47: LOCALE_BCP47[locale] }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}
