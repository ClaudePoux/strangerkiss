"use client";

import { useEffect, useState } from "react";

interface Props {
  userId: string;
  t: (key: string, params?: Record<string, string>) => string;
}

export default function ReferralCard({ userId, t }: Props) {
  const [refCode, setRefCode] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [creditsEarned, setCreditsEarned] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Essayer d'abord localStorage pour éviter le fetch
    try {
      const stored = localStorage.getItem("sk_ref_code");
      if (stored) setRefCode(stored);
    } catch { /* ignore */ }

    fetch(`/api/referral/info?user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ref_code) {
          setRefCode(d.ref_code);
          try { localStorage.setItem("sk_ref_code", d.ref_code); } catch { /* ignore */ }
        }
        setCount(d.count ?? 0);
        setCreditsEarned(d.credits_earned ?? 0);
      })
      .catch(() => {});
  }, [userId]);

  if (!refCode) return null;

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : "https://strangerkiss.com"}?ref=${refCode}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "StrangerKiss", url: shareUrl });
      } catch { /* cancelled */ }
    } else {
      // Fallback: copier dans le presse-papiers
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="bg-white/[0.03] border border-[#7c3aed]/20 rounded-2xl p-4 mx-4 mb-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/70">
            🔗 {t("referral.title")}
          </p>
          <p className="text-xs text-white/30 mt-0.5">{t("referral.subtitle")}</p>
          {count > 0 && (
            <p className="text-xs text-[#a78bfa] mt-1">
              {t("referral.stats", { count: String(count), credits: String(creditsEarned) })}
            </p>
          )}
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 bg-[#7c3aed]/15 hover:bg-[#7c3aed]/30 border border-[#7c3aed]/25 text-[#a78bfa] text-xs font-medium rounded-xl px-3 py-2 transition-all whitespace-nowrap ml-3"
        >
          {copied ? t("referral.copied") : t("referral.shareBtn")}
        </button>
      </div>
    </div>
  );
}
