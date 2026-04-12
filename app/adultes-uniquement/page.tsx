"use client";

import { useI18n } from "@/lib/i18n";

export default function AdultesUniquementPage() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div className="text-6xl">🔞</div>
      <h1 className="text-2xl font-bold text-white">{t("ageGate.blockedTitle")}</h1>
      <p className="text-white/50 max-w-sm leading-relaxed text-sm">{t("ageGate.blockedDesc")}</p>
    </main>
  );
}
