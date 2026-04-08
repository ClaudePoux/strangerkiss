"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "phone" | "code";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Erreur lors de l'envoi du SMS");
      return;
    }
    setStep("code");
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Code incorrect");
      return;
    }
    const user = data.user;
    try {
      localStorage.setItem("sk_user_id", user.id);
      localStorage.setItem("sk_user_phone", user.phone);
      localStorage.setItem("sk_user_credits", String(user.credits));
    } catch {}
    router.push("/profile");
  }

  return (
    <main className="flex flex-col min-h-screen items-center justify-center px-4 py-12 relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#e91e8c]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-4xl font-bold">
            Stranger<span className="text-[#e91e8c]">Kiss</span>
          </Link>
          <p className="mt-3 text-white/50 text-sm">
            {step === "phone"
              ? "Entrez votre numéro pour recevoir un code SMS"
              : `Code envoyé au ${phone}`}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  required
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all"
                />
                <p className="text-xs text-white/30">Format international requis (ex : +33612345678)</p>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !phone}
                className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition-all duration-200 shadow-[0_0_20px_rgba(233,30,140,0.3)] hover:shadow-[0_0_35px_rgba(233,30,140,0.5)]"
              >
                {loading ? "Envoi…" : "Recevoir le code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-white/70">
                  Code de vérification
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  maxLength={6}
                  required
                  inputMode="numeric"
                  autoFocus
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all text-center text-2xl tracking-widest"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 4}
                className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition-all duration-200 shadow-[0_0_20px_rgba(233,30,140,0.3)]"
              >
                {loading ? "Vérification…" : "Confirmer"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("phone"); setError(""); setCode(""); }}
                className="w-full text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                ← Changer de numéro
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          3 crédits offerts à l'inscription · Chat & carte gratuits
        </p>
      </div>
    </main>
  );
}
