"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PhoneVerification from "@/components/PhoneVerification";
import { useI18n } from "@/lib/i18n";

export default function VerifyPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Déjà vérifié → aller directement à la carte
    try {
      if (localStorage.getItem("sk_phone")) {
        router.replace("/map");
        return;
      }
    } catch { /* ignore */ }

    async function init() {
      let uid: string | null = null;
      try { uid = localStorage.getItem("sk_user_id"); } catch { /* ignore */ }

      if (!uid) {
        // Créer un utilisateur anonyme pour pouvoir lier le numéro
        try {
          const res = await fetch("/api/users/init", { method: "POST" });
          const { user_id } = await res.json();
          if (user_id) {
            uid = user_id;
            try { localStorage.setItem("sk_user_id", user_id); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }

      setUserId(uid);
      setReady(true);
    }

    init();
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-3xl animate-pulse">💋</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-white/60 text-sm text-center">Erreur lors de l&apos;initialisation. Réessaye.</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[#e91e8c] text-white px-6 py-2 rounded-full text-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7c3aed]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/">
            <img src="/logo-StrangerKiss-blanc.svg" alt="StrangerKiss" className="h-8 mx-auto mb-5" />
          </Link>
          <div className="inline-flex items-center gap-2 bg-[#e91e8c]/10 border border-[#e91e8c]/25 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#e91e8c] animate-pulse" />
            <span className="text-xs text-[#e91e8c] font-medium">Étape 2 sur 2</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Vérifie ton numéro</h1>
          <p className="mt-2 text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
            Reçois <span className="text-white/80 font-medium">6 crédits</span> et accède à la carte pour rencontrer des gens près de toi.
          </p>
        </div>

        <PhoneVerification
          userId={userId}
          t={t}
          onSuccess={(_bonus, _waitlisted, _refCode, newCredits) => {
            try { localStorage.setItem("sk_user_credits", String(newCredits)); } catch { /* ignore */ }
            router.push("/map");
          }}
        />

        <p className="text-center text-xs text-white/20">
          <Link href="/profile" className="underline hover:text-white/40 transition-colors">
            ← Modifier mon profil
          </Link>
        </p>
      </div>
    </main>
  );
}
