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

      // ── DIAGNOSTIC ──────────────────────────────────────────────────────────
      console.log("[/beta] init — localStorage:", {
        sk_user_id:      storedUserId ? storedUserId.slice(0, 8) + "…" : null,
        sk_phone:        storedPhone  ? storedPhone.slice(0, 4)  + "****" : null,
        sk_my_id:        localStorage.getItem("sk_my_id")     ? "présent" : null,
        sk_user_credits: localStorage.getItem("sk_user_credits"),
      });
      // ────────────────────────────────────────────────────────────────────────

      if (storedUserId) {
        try {
          const url = `/api/session/check?user_id=${encodeURIComponent(storedUserId)}${storedPhone ? `&phone=${encodeURIComponent(storedPhone)}` : ""}`;
          console.log("[/beta] → session/check:", url);

          // Valider la session contre Supabase
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

          console.log("[/beta] ← session/check HTTP:", res.status, res.ok ? "OK" : "ERR");

          if (!res.ok) {
            console.warn("[/beta] session/check HTTP error:", res.status, "→ formulaire sans effacer localStorage");
            setUserId(storedUserId);
            setChecking(false);
            return;
          }

          const sessionData = await res.json();
          console.log("[/beta] ← session/check body:", sessionData);

          if (sessionData.valid) {
            console.log("[/beta] Session valide → router.replace('/profile')");
            router.replace("/profile");
            return;
          }

          // Sécurité : si la réponse est malformée (valid ni true ni false explicitement),
          // ne pas effacer localStorage — afficher le formulaire prudemment.
          if (sessionData.valid !== false) {
            console.warn("[/beta] Réponse session/check inattendue (valid non booléen) → formulaire sans nettoyage", sessionData);
            setUserId(storedUserId);
            setChecking(false);
            return;
          }

          console.warn("[/beta] Session invalide (valid: false explicite):", sessionData);

          // Session invalide — tenter la restauration beta si on a un numéro
          const phoneForRestore = storedPhone;
          if (phoneForRestore) {
            console.log("[/beta] → beta/restore avec phone:", phoneForRestore.slice(0, 4) + "****");
            try {
              const restore = await fetch("/api/beta/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phoneForRestore, user_id: storedUserId }),
                signal: AbortSignal.timeout(8000),
              });
              const restoreData = await restore.json();
              console.log("[/beta] ← beta/restore:", restoreData);
              if (restore.ok && restoreData.ok) {
                localStorage.setItem("sk_user_id", restoreData.user_id);
                localStorage.setItem("sk_phone", phoneForRestore);
                if (restoreData.ref_code) localStorage.setItem("sk_ref_code", restoreData.ref_code);
                if (restoreData.credits != null) localStorage.setItem("sk_user_credits", String(restoreData.credits));
                console.log("[/beta] Restauration OK → router.replace('/profile')");
                router.replace("/profile");
                return;
              }
              console.warn("[/beta] Restauration échouée (not_beta ou erreur API):", restoreData);
            } catch (err) {
              // Erreur réseau sur beta/restore → NE PAS effacer localStorage
              console.warn("[/beta] beta/restore network error:", err);
              setUserId(storedUserId);
              setChecking(false);
              return;
            }
          }

          // Nettoyage minimal : uniquement sk_user_id et données dérivées.
          // sk_phone est conservé intentionnellement — il permet la restauration
          // silencieuse via already_verified si l'utilisateur re-saisit son numéro.
          console.warn(
            "[/beta] Nettoyage sk_user_id — session invalide confirmée, restore échoué.\n" +
            "  storedUserId:", storedUserId?.slice(0, 8) + "…", "\n" +
            "  storedPhone:", storedPhone ? storedPhone.slice(0, 4) + "****" : "absent",
            "\n  Stack:", new Error().stack?.split("\n").slice(1, 4).join(" | ")
          );
          localStorage.removeItem("sk_user_id");
          localStorage.removeItem("sk_my_id");
          localStorage.removeItem("sk_user_credits");
          localStorage.removeItem("sk_ref_code");
          // sk_phone intentionnellement conservé pour permettre la restauration

        } catch (err) {
          // Erreur réseau (AbortError timeout, offline…) → NE PAS effacer localStorage
          console.warn("[/beta] session check network error:", err);
          setUserId(storedUserId);
          setChecking(false);
          return;
        }
      }

      // Pas de session → créer un utilisateur anonyme pour la vérification
      console.log("[/beta] Pas de storedUserId (nettoyé ou premier accès) → beta/init");
      try {
        const r = await fetch("/api/beta/init", { method: "POST" });
        const { user_id } = await r.json();
        console.log("[/beta] beta/init → nouveau user_id anonyme:", user_id ? user_id.slice(0, 8) + "…" : null);
        if (user_id) {
          setUserId(user_id);
          // Note : remplace l'éventuel ancien sk_user_id supprimé juste au-dessus
          localStorage.setItem("sk_user_id", user_id);
        }
      } catch (err) {
        console.error("[/beta] beta/init error:", err);
      }

      console.log("[/beta] setChecking(false) → formulaire affiché");
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
        // Numéro déjà vérifié → récupérer la session silencieusement
        try {
          const restore = await fetch("/api/beta/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phone.trim(), user_id: userId ?? undefined }),
          });
          const restoreData = await restore.json();
          if (restore.ok && restoreData.ok) {
            localStorage.setItem("sk_user_id", restoreData.user_id);
            localStorage.setItem("sk_phone", phone.trim());
            if (restoreData.ref_code)  localStorage.setItem("sk_ref_code",      restoreData.ref_code);
            if (restoreData.credits != null) localStorage.setItem("sk_user_credits", String(restoreData.credits));
            router.replace("/profile");
            return;
          }
        } catch { /* ignore, affiche le formulaire normalement */ }
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
          <img src="/levres.svg" alt="" className="w-14 h-14 mb-3 mx-auto" />
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
