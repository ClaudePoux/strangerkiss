"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LaunchSection from "@/components/LaunchSection";

// Capture le code de parrainage depuis l'URL (?ref=XXXXXXXX)
function RefCapture() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      try { localStorage.setItem("sk_ref", ref); } catch { /* ignore */ }
    }
  }, [searchParams]);
  return null;
}

function Tagline({ text }: { text: string }) {
  const parts = text.split(/(\{hug\}|\{frenchKiss\})/);
  return (
    <>
      {parts.map((part, i) =>
        part === "{hug}" ? (
          <strong key={i} className="text-white/80">
            hug
          </strong>
        ) : part === "{frenchKiss}" ? (
          <strong key={i} className="text-[#e91e8c]">
            French kiss
          </strong>
        ) : (
          part
        )
      )}
    </>
  );
}

export default function HomePage() {
  // useRouter est utilisé mais useSearchParams doit rester dans un Suspense boundary
  const { t } = useI18n();
  const router = useRouter();

  function startDemo() {
    router.push("/profile?demo=true");
  }

  const steps = [
    { icon: "✏️", title: t("home.step1Title"), desc: t("home.step1Desc"), demo: false },
    { icon: "📍", title: t("home.step2Title"), desc: t("home.step2Desc"), demo: false },
    { icon: "💞", title: t("home.step3Title"), desc: t("home.step3Desc"), demo: false },
    { icon: "🗺️", title: t("home.step4Title"), desc: t("home.step4Desc"), demo: true },
  ];

  return (
    <main className="flex flex-col min-h-screen">
      {/* Capture du code de parrainage depuis l'URL */}
      <Suspense>
        <RefCapture />
      </Suspense>

      {/* Language switcher — hors du overflow-hidden pour que le dropdown soit visible */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 pt-20 pb-16 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#e91e8c]/10 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-[#7c3aed]/10 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto w-full">
          <div className="text-7xl mb-6 select-none">💋</div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4">
            <span className="text-white">Stranger</span>
            <span className="text-[#e91e8c]">Kiss</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 mb-4 leading-relaxed">
            <Tagline text={t("home.tagline")} />
          </p>

          {/* Badge "Bientôt disponible" */}
          <div className="inline-flex items-center gap-2 bg-[#e91e8c]/10 border border-[#e91e8c]/25 rounded-full px-4 py-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#e91e8c] animate-pulse" />
            <span className="text-xs text-[#e91e8c] font-medium">{t("home.launchingSoon")}</span>
          </div>

          {/* Countdown + waitlist */}
          <LaunchSection />

          <p className="mt-6 text-sm text-white/30">{t("home.disclaimer")}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-2xl font-semibold text-white/80 mb-10">
            {t("home.howItWorks")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step) => (
              <div
                key={step.title}
                className={`bg-white/5 border rounded-2xl p-6 text-center hover:bg-white/[0.08] transition-colors flex flex-col items-center ${
                  step.demo ? "border-[#e91e8c]/25 shadow-[0_0_20px_rgba(233,30,140,0.06)]" : "border-white/10"
                }`}
              >
                <div className="text-4xl mb-3">{step.icon}</div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed flex-1">
                  {step.desc}
                </p>
                {step.demo && (
                  <button
                    onClick={startDemo}
                    className="mt-4 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white bg-[#e91e8c]/10 hover:bg-[#e91e8c]/20 border border-[#e91e8c]/25 rounded-full px-5 py-2 transition-all"
                  >
                    {t("home.ctaDemo")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/20 space-y-2">
        <p>{t("home.footer")}</p>
        <p className="flex items-center justify-center gap-3">
          <Link href="/mentions-legales" className="hover:text-white/50 transition-colors">
            Mentions légales
          </Link>
          <span>·</span>
          <Link href="/politique-de-confidentialite" className="hover:text-white/50 transition-colors">
            Politique de confidentialité
          </Link>
        </p>
      </footer>
    </main>
  );
}
