"use client";

import Link from "next/link";

export default function CreditsCancelPage() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center px-4 py-12 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#7c3aed]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm text-center space-y-6">
        <div className="text-5xl">↩️</div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Paiement annulé</h1>
          <p className="text-white/50 text-sm">Aucun montant n&apos;a été débité.</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/credits"
            className="w-full bg-[#e91e8c] hover:bg-[#c2186f] text-white font-semibold py-3.5 rounded-2xl transition-all"
          >
            Réessayer
          </Link>
          <Link
            href="/map"
            className="w-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium py-3 rounded-2xl transition-all border border-white/10"
          >
            Retour à la carte
          </Link>
        </div>
      </div>
    </main>
  );
}
