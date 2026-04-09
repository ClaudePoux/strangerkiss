"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

// Date de lancement : 9 mai 2026
const LAUNCH_DATE = new Date("2026-05-09T00:00:00Z");

function useCountdown() {
  const [diff, setDiff] = useState(() => Math.max(0, LAUNCH_DATE.getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setDiff(Math.max(0, LAUNCH_DATE.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, launched: diff === 0 };
}

export default function LaunchSection() {
  const { t } = useI18n();
  const { days, hours, minutes, seconds, launched } = useCountdown();

  const [phone, setPhone]     = useState("");
  const [status, setStatus]   = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [count, setCount]     = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then(({ count: c }) => setCount(c))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || status === "loading" || status === "success") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setCount((c) => (c ?? 0) + 1);
      } else if (data.error === "already_registered") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (launched) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="w-full max-w-xl mx-auto mt-10 mb-2">
      {/* Countdown */}
      <div className="flex items-center justify-center gap-3 sm:gap-5 mb-8">
        {[
          { value: days,    label: t("home.days") },
          { value: hours,   label: t("home.hours") },
          { value: minutes, label: t("home.minutes") },
          { value: seconds, label: t("home.seconds") },
        ].map(({ value, label }, i) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-16 sm:w-20 h-16 sm:h-20 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-inner">
              <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                {pad(value)}
              </span>
            </div>
            <span className="mt-1.5 text-[10px] sm:text-xs text-white/30 uppercase tracking-widest">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Waitlist card */}
      <div className="bg-white/[0.04] border border-[#e91e8c]/20 rounded-3xl px-6 py-7 backdrop-blur-sm shadow-[0_0_40px_rgba(233,30,140,0.08)]">
        <p className="text-base sm:text-lg font-semibold text-white text-center mb-5 leading-snug">
          {t("home.waitlistTitle")}
        </p>

        {status === "success" ? (
          <p className="text-center text-green-300 text-sm font-medium py-2">
            {t("home.waitlistSuccess")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("home.waitlistPhone")}
              required
              className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/50 focus:ring-2 focus:ring-[#e91e8c]/15 transition-all text-sm"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white font-semibold text-sm px-6 py-3 rounded-2xl transition-all shadow-[0_0_20px_rgba(233,30,140,0.3)] hover:shadow-[0_0_35px_rgba(233,30,140,0.5)] hover:scale-[1.02] active:scale-95 whitespace-nowrap"
            >
              {status === "loading" ? "…" : t("home.waitlistCta")}
            </button>
          </form>
        )}

        {status === "already" && (
          <p className="mt-2 text-center text-amber-400/80 text-xs">{t("home.waitlistAlready")}</p>
        )}
        {status === "error" && (
          <p className="mt-2 text-center text-red-400/80 text-xs">{t("home.waitlistError")}</p>
        )}

        {/* Social proof */}
        {count !== null && count > 0 && (
          <p className="mt-4 text-center text-xs text-white/30">
            {t("home.waitlistCount", { count: String(count) })}
          </p>
        )}
      </div>
    </div>
  );
}
