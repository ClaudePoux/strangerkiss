"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CREDIT_PACKS } from "@/lib/stripe";

function CreditsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);

  const success = searchParams.get("success") === "1";
  const cancelled = searchParams.get("cancelled") === "1";

  useEffect(() => {
    try {
      const id = localStorage.getItem("sk_user_id");
      if (!id) { router.push("/auth"); return; }
      setUserId(id);
      // Rafraîchir le solde depuis MySQL via API
      fetch(`/api/credits/balance?user_id=${id}`)
        .then((r) => r.json())
        .then(({ credits: c }) => {
          if (c !== null) {
            setCredits(c);
            localStorage.setItem("sk_user_credits", String(c));
          } else {
            setCredits(parseInt(localStorage.getItem("sk_user_credits") ?? "0", 10));
          }
        })
        .catch(() => {
          setCredits(parseInt(localStorage.getItem("sk_user_credits") ?? "0", 10));
        });
    } catch {
      router.push("/auth");
    }
  }, [router, success]);

  async function handleBuy(packId: string) {
    if (!userId) return;
    setBuying(packId);
    const res = await fetch("/api/credits/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId, userId }),
    });
    const data = await res.json();
    setBuying(null);
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <main className="flex flex-col min-h-screen items-center justify-center px-4 py-12 relative">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7c3aed]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/map"
            className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Mes crédits</h1>
            <p className="text-sm text-white/40">
              1 crédit = 1 rencontre acceptée par les deux
            </p>
          </div>
        </div>

        {/* Solde */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center mb-6">
          <div className="text-5xl font-bold text-white mb-1">
            {credits === null ? "…" : credits}
          </div>
          <div className="text-sm text-white/50">
            crédit{credits !== 1 ? "s" : ""} disponible{credits !== 1 ? "s" : ""}
          </div>
          {credits === 0 && (
            <p className="mt-3 text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
              Plus de crédits — rechargez pour proposer une rencontre
            </p>
          )}
        </div>

        {/* Notifications */}
        {success && (
          <div className="mb-4 px-4 py-3 bg-green-500/15 border border-green-500/25 rounded-2xl text-green-300 text-sm text-center">
            Paiement confirmé ! Vos crédits ont été ajoutés.
          </div>
        )}
        {cancelled && (
          <div className="mb-4 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white/50 text-sm text-center">
            Paiement annulé.
          </div>
        )}

        {/* Packs */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Recharger
          </h2>
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleBuy(pack.id)}
              disabled={buying !== null}
              className={`relative w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${
                "popular" in pack && pack.popular
                  ? "border-[#e91e8c]/40 bg-[#e91e8c]/10 hover:bg-[#e91e8c]/15"
                  : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
              } disabled:opacity-50`}
            >
              {"popular" in pack && pack.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold bg-[#e91e8c] text-white px-2.5 py-0.5 rounded-full">
                  Populaire
                </span>
              )}
              <div className="text-left">
                <div className="font-semibold text-white">{pack.label}</div>
                <div className="text-sm text-white/50">{pack.description}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-white">
                  {(pack.price / 100).toFixed(2).replace(".", ",")} €
                </div>
                {buying === pack.id && (
                  <div className="text-xs text-white/40 animate-pulse">Chargement…</div>
                )}
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          Paiement sécurisé par Stripe · CB, Apple Pay, Google Pay
        </p>
      </div>
    </main>
  );
}

export default function CreditsPage() {
  return (
    <Suspense>
      <CreditsContent />
    </Suspense>
  );
}
