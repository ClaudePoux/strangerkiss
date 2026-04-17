"use client";

import { useState } from "react";

interface Props {
  userId: string;
  onSuccess: (bonusCredits: number, isWaitlisted: boolean, refCode: string, newCredits: number) => void;
  onDismiss: () => void;
  t: (key: string, params?: Record<string, string>) => string;
}

export default function PhoneVerification({ userId, onSuccess, onDismiss, t }: Props) {
  const [step, setStep] = useState<"phone" | "code" | "success">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bonusResult, setBonusResult] = useState<{ bonus: number; waitlisted: boolean } | null>(null);

  async function handleSendCode(e: React.FormEvent) {
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
      } else if (data.error === "phone_invalid") {
        setError(t("verify.errorPhoneInvalid"));
      } else if (data.error === "banned") {
        setError(t("profile.errorBanned24h"));
      } else {
        setError(t("verify.errorSendFailed"));
      }
    } catch {
      setError(t("verify.errorSendFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) return;
    setLoading(true);
    try {
      let sponsorRef: string | undefined;
      try { sponsorRef = localStorage.getItem("sk_ref") ?? undefined; } catch { /* ignore */ }

      const res = await fetch("/api/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          code: code.trim(),
          user_id: userId,
          sponsor_ref: sponsorRef,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBonusResult({ bonus: data.bonus_credits, waitlisted: data.is_waitlisted });
        setStep("success");
        // Sauvegarder le numéro et le ref_code en localStorage
        try {
          localStorage.setItem("sk_phone", phone.trim());
          if (data.ref_code) localStorage.setItem("sk_ref_code", data.ref_code);
          // Effacer le code de parrainage utilisé
          localStorage.removeItem("sk_ref");
        } catch { /* ignore */ }
        setTimeout(() => {
          onSuccess(data.bonus_credits, data.is_waitlisted, data.ref_code, data.new_credits);
        }, 2000);
      } else if (data.error === "code_invalid") {
        setError(t("verify.errorInvalid"));
      } else if (data.error === "code_expired") {
        setError(t("verify.errorExpired"));
        setStep("phone");
        setCode("");
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

  return (
    <div className="bg-white/[0.04] border border-[#e91e8c]/20 rounded-2xl p-5 mx-4 mb-3 shadow-[0_0_30px_rgba(233,30,140,0.08)]">
      {step === "success" && bonusResult ? (
        <div className="text-center py-2">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-white font-semibold">
            {bonusResult.waitlisted
              ? t("verify.successWaitlist", { credits: String(bonusResult.bonus) })
              : t("verify.successBonus", { credits: String(bonusResult.bonus) })}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">
                💰 {t("verify.title")}
              </p>
              <p className="text-xs text-white/40 mt-0.5">{t("verify.subtitle")}</p>
            </div>
            <button
              onClick={onDismiss}
              className="text-white/30 hover:text-white/60 text-lg leading-none ml-3 transition-colors"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("verify.phonePlaceholder")}
                  required
                  className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:border-[#e91e8c]/50 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap"
                >
                  {loading ? "…" : t("verify.sendCode")}
                </button>
              </div>
              <p className="text-xs text-white/30">{t("verify.phoneHint")}</p>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("verify.codePlaceholder")}
                required
                autoFocus
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:border-[#e91e8c]/50 transition-all tracking-widest"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all"
              >
                {loading ? "…" : t("verify.verify")}
              </button>
            </form>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-400">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
