"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LookingFor, Gender } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CountrySelect from "@/components/CountrySelect";

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender>("femme");
  const [nationality, setNationality] = useState("");
  const [bio, setBio] = useState("");
  const [appearance, setAppearance] = useState("");
  const [lookingFor, setLookingFor] = useState<LookingFor>("hug");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const GENDERS: { value: Gender; label: string; icon: string }[] = [
    { value: "femme", label: t("profile.genderFemme"), icon: "♀️" },
    { value: "homme", label: t("profile.genderHomme"), icon: "♂️" },
    { value: "non-binaire", label: t("profile.genderNonBinaire"), icon: "⚧" },
    { value: "autre", label: t("profile.genderAutre"), icon: "✨" },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    const ageNum = parseInt(age, 10);
    if (!name.trim()) return setError(t("profile.errorName"));
    if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 99)
      return setError(t("profile.errorAge"));

    setLoading(true);

    // Vérification du ban si un numéro de téléphone est enregistré (sauf en mode démo)
    if (!isDemo) {
      try {
        const phone = localStorage.getItem("sk_phone");
        if (phone) {
          const res = await fetch(`/api/moderation/check-ban?phone=${encodeURIComponent(phone)}`);
          const { banned, ban_type } = await res.json();
          if (banned) {
            setLoading(false);
            return setError(
              ban_type === "permanent"
                ? t("profile.errorBannedPermanent")
                : t("profile.errorBanned24h")
            );
          }
        }
      } catch {
        // Si la vérification échoue, on laisse passer (fail open)
      }
    }

    const profile = {
      name: name.trim(),
      age: ageNum,
      gender,
      nationality,
      bio: bio.trim(),
      appearance: appearance.trim(),
      looking_for: lookingFor,
    };
    try {
      localStorage.setItem("sk_profile", JSON.stringify(profile));
    } catch {
      // localStorage unavailable
    }

    router.push(isDemo ? "/map?demo=true" : "/map");
  }

  return (
    <main className="flex flex-col min-h-screen items-center justify-center px-4 py-12 relative">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7c3aed]/10 blur-[120px] pointer-events-none" />

      {/* Language switcher — fixed pour éviter le conflit de stacking context avec backdrop-blur */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✨</div>
          <h1 className="text-3xl font-bold text-white">
            Stranger<span className="text-[#e91e8c]">Kiss</span>
          </h1>
          <p className="mt-2 text-white/50 text-sm">{t("profile.header")}</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6 backdrop-blur-sm"
        >
          {/* Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              {t("profile.nameLabel")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("profile.namePlaceholder")}
              maxLength={30}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all"
            />
          </div>

          {/* Age */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              {t("profile.ageLabel")}{" "}
              <span className="text-white/30">{t("profile.ageMin")}</span>
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder={t("profile.agePlaceholder")}
              min={18}
              max={99}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all"
            />
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              {t("profile.genderLabel")}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {GENDERS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all ${
                    gender === opt.value
                      ? "border-[#7c3aed] bg-[#7c3aed]/20 text-white shadow-[0_0_16px_rgba(124,58,237,0.3)]"
                      : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nationality */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              {t("profile.nationalityLabel")}{" "}
              <span className="text-white/30">{t("profile.optional")}</span>
            </label>
            <CountrySelect
              value={nationality}
              onChange={setNationality}
              placeholder={t("profile.nationalityPlaceholder")}
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              {t("profile.bioLabel")}{" "}
              <span className="text-white/30">{t("profile.optional")}</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("profile.bioPlaceholder")}
              maxLength={120}
              rows={2}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all resize-none"
            />
            <p className="text-right text-xs text-white/20">{bio.length}/120</p>
          </div>

          {/* Appearance */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              {t("profile.appearanceLabel")}{" "}
              <span className="text-white/30">{t("profile.optional")}</span>
            </label>
            <input
              type="text"
              value={appearance}
              onChange={(e) => setAppearance(e.target.value)}
              placeholder={t("profile.appearancePlaceholder")}
              maxLength={80}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/60 focus:ring-2 focus:ring-[#e91e8c]/20 transition-all"
            />
            <p className="text-right text-xs text-white/20">
              {appearance.length}/80
            </p>
          </div>

          {/* Looking for */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/70">
              {t("profile.lookingForLabel")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "hug" as LookingFor, label: t("profile.hug"), icon: "🤗" },
                  {
                    value: "french_kiss" as LookingFor,
                    label: t("profile.frenchKiss"),
                    icon: "💋",
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLookingFor(opt.value)}
                  className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border text-sm font-medium transition-all ${
                    lookingFor === opt.value
                      ? "border-[#e91e8c] bg-[#e91e8c]/15 text-white shadow-[0_0_20px_rgba(233,30,140,0.25)]"
                      : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  <span className="text-3xl">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-all duration-200 shadow-[0_0_20px_rgba(233,30,140,0.3)] hover:shadow-[0_0_35px_rgba(233,30,140,0.5)] hover:scale-[1.02] active:scale-95"
          >
            {loading ? t("profile.loading") : t("profile.submit")}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageContent />
    </Suspense>
  );
}
