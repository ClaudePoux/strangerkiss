"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";

export default function NotreHistoirePage() {
  const { t, locale } = useI18n();
  const [dbContent, setDbContent] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/legal/notre-histoire?lang=${locale}`)
      .then(r => r.json())
      .then(d => { if (d.content) setDbContent(d.content); })
      .catch(() => {});
  }, [locale]);

  return (
    <main className="min-h-screen px-6 py-16 max-w-2xl mx-auto">
      <div className="mb-10">
        <Link
          href="/"
          className="text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          {t("story.back")}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-12">{t("story.title")}</h1>

      <div className="space-y-6 text-white/70 leading-relaxed text-base">
        {dbContent ? (
          <p className="whitespace-pre-line">{dbContent}</p>
        ) : (
          <>
            <p className="text-white/50 text-sm italic">{t("story.p1")}</p>
            <p>{t("story.p2")}</p>
            <p>{t("story.p3")}</p>
            <p className="text-white text-lg font-medium">{t("story.p4")}</p>
            <p>{t("story.p5")}</p>
            <p>{t("story.p6")}</p>
            <p>{t("story.p7")}</p>
            <p className="text-white/90">{t("story.p8")}</p>
            <p className="text-white/50 pt-4 border-t border-white/10">{t("story.signature")}</p>
          </>
        )}
      </div>
    </main>
  );
}
