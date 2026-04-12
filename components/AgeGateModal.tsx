"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  t: (key: string, params?: Record<string, string>) => string;
  onConfirmed: () => void;
}

export default function AgeGateModal({ t, onConfirmed }: Props) {
  const router = useRouter();
  const [year, setYear] = useState("");
  const [error, setError] = useState("");

  function handleConfirm() {
    const y = parseInt(year, 10);
    const currentYear = new Date().getFullYear();

    if (!y || y < 1900 || y > currentYear) {
      setError(t("ageGate.errorInvalid"));
      return;
    }

    const age = currentYear - y;
    if (age < 18) {
      router.push("/adultes-uniquement");
      return;
    }

    // Majeur — persister
    try {
      localStorage.setItem("sk_age_verified", "true");
      localStorage.setItem("sk_birth_year", String(y));
      // Sauvegarder en base si user_id connu
      const userId = localStorage.getItem("sk_user_id");
      if (userId) {
        fetch("/api/age-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, birth_year: y }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }

    onConfirmed();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-8 max-w-sm w-full space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="text-4xl">🔞</div>
          <h2 className="text-xl font-bold text-white">{t("ageGate.title")}</h2>
          <p className="text-sm text-white/50 leading-relaxed">{t("ageGate.subtitle")}</p>
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-white/40 uppercase tracking-wider">
            {t("ageGate.yearLabel")}
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => { setYear(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
            placeholder={t("ageGate.yearPlaceholder")}
            min={1900}
            max={new Date().getFullYear()}
            style={{ fontSize: "16px" }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 outline-none focus:border-[#e91e8c]/50 focus:ring-2 focus:ring-[#e91e8c]/15 transition-all text-center text-lg"
          />
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        </div>

        <button
          onClick={handleConfirm}
          className="w-full bg-[#e91e8c] hover:bg-[#c2186f] text-white font-semibold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(233,30,140,0.3)] active:scale-95"
        >
          {t("ageGate.cta")}
        </button>

        <p className="text-[10px] text-white/20 text-center">{t("ageGate.legal")}</p>
      </div>
    </div>
  );
}
