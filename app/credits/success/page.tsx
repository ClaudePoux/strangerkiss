"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const credits = searchParams.get("credits") ?? "?";
  const pack    = searchParams.get("pack") ?? "";

  // Rafraîchir le solde en localStorage depuis l'API (le webhook a déjà crédité)
  useEffect(() => {
    const userId = typeof window !== "undefined" ? localStorage.getItem("sk_user_id") : null;
    if (!userId) return;
    fetch(`/api/credits/balance?user_id=${userId}`)
      .then(r => r.json())
      .then(({ credits: c }) => {
        if (c != null) localStorage.setItem("sk_user_credits", String(c));
      })
      .catch(() => {});
  }, []);

  // Redirection automatique vers la carte après 4 secondes
  useEffect(() => {
    const t = setTimeout(() => router.replace("/map"), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="flex flex-col min-h-screen items-center justify-center px-4 py-12 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-green-500/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm text-center space-y-6">
        <div className="text-6xl animate-bounce">🎉</div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Paiement confirmé !</h1>
          <p className="text-white/60 text-sm">
            {pack && <span className="text-[#e91e8c] font-semibold">Pack {pack} · </span>}
            <span className="text-white font-bold">+{credits} crédits</span> ajoutés à ton compte
          </p>
        </div>

        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4">
          <p className="text-green-300 text-sm">
            Tes crédits sont disponibles immédiatement. 1 crédit = 1 rencontre acceptée par les deux.
          </p>
        </div>

        <Link
          href="/map"
          className="inline-block w-full bg-[#e91e8c] hover:bg-[#c2186f] text-white font-semibold py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(233,30,140,0.3)]"
        >
          Retour à la carte →
        </Link>

        <p className="text-xs text-white/20">Redirection automatique dans quelques secondes…</p>
      </div>
    </main>
  );
}

export default function CreditsSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
