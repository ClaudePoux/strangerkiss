"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useI18n, LOCALE_BCP47, type Locale } from "@/lib/i18n";

// Curated list of common traveller nationalities (ISO 3166-1 alpha-2)
const COUNTRIES = [
  "FR","BE","CH","LU","MC",
  "GB","IE","US","AU","NZ","CA",
  "DE","AT",
  "IT",
  "ES","MX","AR","CO","CL","PE","BR","PT",
  "RU","UA","BY","KZ",
  "CN","TW","HK","JP","KR",
  "NL","SE","NO","DK","FI","PL","CZ","HU","RO","GR",
  "TR","IN","ID","TH","VN","MY","PH","SG",
  "ZA","NG","EG","MA","KE",
  "IL","SA","AE","IR","PK",
];

function flagEmoji(code: string): string {
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("");
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
}

export default function CountrySelect({ value, onChange, placeholder }: Props) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayNames = useMemo(() => {
    const bcp47 = LOCALE_BCP47[locale as Locale] ?? locale;
    try {
      return new Intl.DisplayNames([bcp47], { type: "region" });
    } catch {
      return new Intl.DisplayNames(["en"], { type: "region" });
    }
  }, [locale]);

  const countries = useMemo(() =>
    COUNTRIES
      .map(code => ({ code, name: displayNames.of(code) ?? code, flag: flagEmoji(code) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [displayNames]
  );

  const filtered = useMemo(() => {
    if (!query) return countries;
    const q = query.toLowerCase();
    return countries.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countries, query]);

  const selected = useMemo(
    () => countries.find(c => c.code === value),
    [countries, value]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-left flex items-center gap-2 hover:border-white/20 focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all"
      >
        {selected ? (
          <>
            <span className="text-xl">{selected.flag}</span>
            <span className="text-white text-sm">{selected.name}</span>
          </>
        ) : (
          <span className="text-white/30 text-sm">{placeholder ?? "—"}</span>
        )}
        <span className="ml-auto text-white/30 text-xs">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#1a0a2e] border border-white/15 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-2 border-b border-white/10">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="🔍"
                className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onChange(c.code); setOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                    c.code === value
                      ? "bg-[#7c3aed]/20 text-white"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <span className="text-lg">{c.flag}</span>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
