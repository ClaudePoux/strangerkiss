"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type Step = "phone" | "code" | "success";

export default function BetaPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function init() {
      const storedUserId = localStorage.getItem("sk_user_id");
      const storedPhone  = localStorage.getItem("sk_phone");

      if (storedUserId) {
        try {
          // Valider la session contre Supabase
          const res = await fetch(
            `/api/session/check?user_id=${encodeURIComponent(storedUserId)}${storedPhone ? `&phone=${encodeURIComponent(storedPhone)}` : ""}`,
            { signal: AbortSignal.timeout(8000) }   // timeout 8s pour cold-start Vercel
          );

          if (!res.ok) {
            // Erreur serveur (5xx) : conserver le localStorage, réessayer au prochain chargement
            console.warn("[/beta] session/check HTTP error:", res.status);
            // Montrer le formulaire sans effacer la session
            setUserId(storedUserId);
            setChecking(false);
            return;
          }

          const { valid } = await res.json();

          if (valid) {
            router.replace("/profile");
            return;
          }

          // Session invalide — si on a un numéro, tenter la restauration beta
          if (storedPhone) {
            try {
              const restore = await fetch("/api/beta/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: storedPhone, user_id: storedUserId }),
                signal: AbortSignal.timeout(8000),
              });
              if (restore.ok) {
                const restoreData = await restore.json();
                if (restoreData.ok) {
                  localStorage.setItem("sk_user_id", restoreData.user_id);
                  localStorage.setItem("sk_phone", storedPhone);
                  if (restoreData.ref_code) localStorage.setItem("sk_ref_code", restoreData.ref_code);
                  if (restoreData.credits != null) localStorage.setItem("sk_user_credits", String(restoreData.credits));
                  router.replace("/profile");
                  return;
                }
              }
            } catch {
              // Erreur réseau sur beta/restore → conserver localStorage, montrer le formulaire
              console.warn("[/beta] beta/restore network error");
              setUserId(storedUserId);
              setChecking(false);
              return;
            }
          }

          // Session définitivement invalide (confirmé par l'API) → nettoyer
          localStorage.removeItem("sk_user_id");
          localStorage.removeItem("sk_phone");
          localStorage.removeItem("sk_my_id");
          localStorage.removeItem("sk_user_credits");
          localStorage.removeItem("sk_ref_code");

        } catch (err) {
          // Erreur réseau (AbortError timeout, offline…) → NE PAS effacer localStorage
          console.warn("[/beta] session check network error:", err);
          setUserId(storedUserId);
          setChecking(false);
          return;
        }
      }

      // Pas de session → créer un utilisateur anonyme pour la vérification
      try {
        const r = await fetch("/api/beta/init", { method: "POST" });
        const { user_id } = await r.json();
        if (user_id) {
          setUserId(user_id);
          localStorage.setItem("sk_user_id", user_id);
        }
      } catch { /* ignore */ }

      setChecking(false);
    }
    init();
  }, [router]);

  async function handleSendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!phone.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setStep("code");
      } else if (data.error === "already_verified") {
        setError(t("verify.errorAlreadyVerified"));
      } else {
        setError(t("verify.errorSendFailed"));
      }
    } catch {
      setError(t("verify.errorSendFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!code.trim() || !userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), user_id: userId }),
      });
      const data = await res.json();
      if (data.ok) {
        try {
          localStorage.setItem("sk_phone", phone.trim());
          if (data.ref_code) localStorage.setItem("sk_ref_code", data.ref_code);
        } catch { /* ignore */ }
        setStep("success");
      } else if (data.error === "code_invalid") {
        setError(t("verify.errorInvalid"));
      } else if (data.error === "code_expired") {
        setError(t("verify.errorExpired"));
        setStep("phone");
        setCode("");
      } else {
        setError(t("verify.errorSendFailed"));
      }
    } catch {
      setError(t("verify.errorSendFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col min-h-screen items-center justify-center px-4 py-12 relative">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7c3aed]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-white">
            Stranger<span className="text-[#e91e8c]">Kiss</span>
          </h1>
          <p className="mt-2 text-white/40 text-sm">Accès bêta</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
          {checking ? (
            <div className="text-center py-4">
              <div className="text-3xl animate-pulse">⏳</div>
              <p className="text-white/30 text-sm mt-2">Vérification de la session…</p>
            </div>
          ) : step === "success" ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">🎉</div>
              <p className="text-white font-bold text-lg">Accès bêta activé !</p>
              <p className="text-white/50 text-sm">
                Ton numéro est vérifié. Tu peux maintenant utiliser toutes les fonctionnalités.
              </p>
              <button
                onClick={() => router.push("/profile")}
                className="w-full bg-[#e91e8c] hover:bg-[#c2186f] text-white font-semibold py-3 rounded-2xl transition-all shadow-[0_0_20px_rgba(233,30,140,0.3)]"
              >
                Créer mon profil →
              </button>
            </div>
          ) : step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Ton numéro de téléphone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  required
                  autoFocus
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading || !userId}
                className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-all"
              >
                {loading ? "…" : "Recevoir le code SMS"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Code reçu par SMS
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all tracking-[0.3em] text-center text-lg"
                />
                <p className="mt-1.5 text-xs text-white/30">
                  Envoyé au {phone} ·{" "}
                  <button
                    type="button"
                    onClick={() => { setStep("phone"); setCode(""); setError(""); }}
                    className="underline hover:text-white/60"
                  >
                    Changer
                  </button>
                </p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-all"
              >
                {loading ? "…" : "Valider"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
