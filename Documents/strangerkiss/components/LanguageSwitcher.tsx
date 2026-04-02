"use client";

import { useState } from "react";
import { useI18n, LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1.5 transition-all"
        aria-label="Change language"
      >
        🌐 <span className="font-medium">{locale.toUpperCase()}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 bg-[#1a0a2e] border border-white/15 rounded-2xl overflow-hidden shadow-xl min-w-[150px]">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLocale(l as Locale);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  l === locale
                    ? "bg-[#7c3aed]/20 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {LOCALE_NAMES[l as Locale]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
