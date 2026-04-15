"use client";

import { useState } from "react";

interface Props {
  t: (key: string, params?: Record<string, string>) => string;
  onClose: () => void;
}

type Travel = "seul" | "couple" | "les_deux";
type Discovery = "social" | "word" | "referral" | "influencer" | "press" | "google" | "other";
type Step = "q1" | "q2" | "result";

function getMsgKey(profileGender: string | null, travel: Travel | null): string {
  if (travel === "couple")   return "survey.msgCouple";
  if (travel === "les_deux") return "survey.msgBoth";
  if (profileGender === "femme") return "survey.msgWomanAlone";
  if (profileGender === "homme") return "survey.msgManAlone";
  return "survey.msgDefault";
}

export default function SurveyModal({ t, onClose }: Props) {
  const [step, setStep]           = useState<Step>("q1");
  const [travel, setTravel]       = useState<Travel | null>(null);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);

  // Lire le genre depuis le profil déjà renseigné (pas demandé dans l'enquête)
  function getProfileGender(): string | null {
    try {
      const p = localStorage.getItem("sk_profile");
      if (p) return JSON.parse(p)?.gender ?? null;
    } catch { /* ignore */ }
    return null;
  }

  function handleTravel(tr: Travel) {
    setTravel(tr);
    setStep("q2");
  }

  function handleDiscovery(dc: Discovery) {
    setDiscovery(dc);
    try {
      localStorage.setItem("sk_survey_done", "true");
      localStorage.removeItem("sk_survey_pending");
      const userId = localStorage.getItem("sk_user_id");
      if (userId) {
        fetch("/api/survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            travel_situation: travel,
            discovery_channel: dc,
          }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }
    setStep("result");
  }

  const btnClass =
    "py-3 rounded-xl bg-white/5 hover:bg-[#e91e8c]/15 border border-white/10 hover:border-[#e91e8c]/30 text-white/80 hover:text-white text-sm transition-all active:scale-95 text-left px-4";

  const DISCOVERY_OPTIONS: { key: Discovery; label: string }[] = [
    { key: "social",     label: t("survey.q2social") },
    { key: "word",       label: t("survey.q2word") },
    { key: "referral",   label: t("survey.q2referral") },
    { key: "influencer", label: t("survey.q2influencer") },
    { key: "press",      label: t("survey.q2press") },
    { key: "google",     label: t("survey.q2google") },
    { key: "other",      label: t("survey.q2other") },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4" style={{ zIndex: 9999 }}>
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl">

        {step === "q1" && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <div className="text-3xl">✈️</div>
              <h2 className="text-lg font-bold text-white">{t("survey.title")}</h2>
              <p className="text-xs text-white/40">{t("survey.subtitle")}</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-white/70 font-medium">{t("survey.q1")}</p>
              <div className="flex flex-col gap-2">
                <button className={btnClass} onClick={() => handleTravel("seul")}>{t("survey.q1alone")}</button>
                <button className={btnClass} onClick={() => handleTravel("couple")}>{t("survey.q1couple")}</button>
                <button className={btnClass} onClick={() => handleTravel("les_deux")}>{t("survey.q1both")}</button>
              </div>
            </div>
            <button onClick={onClose} className="w-full text-xs text-white/20 hover:text-white/40 transition-colors py-1">
              {t("survey.skip")}
            </button>
          </div>
        )}

        {step === "q2" && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-3xl">💡</div>
              <h2 className="text-base font-bold text-white">{t("survey.q2")}</h2>
            </div>
            <div className="flex flex-col gap-1.5">
              {DISCOVERY_OPTIONS.map(({ key, label }) => (
                <button key={key} className={btnClass} onClick={() => handleDiscovery(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="space-y-5 text-center">
            <div className="text-3xl">🎉</div>
            <h2 className="text-lg font-bold text-white">{t("survey.thankYou")}</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              {t(getMsgKey(getProfileGender(), travel))}
            </p>
            <button
              onClick={onClose}
              className="w-full bg-[#e91e8c] hover:bg-[#c2186f] text-white font-semibold py-3 rounded-xl transition-all"
            >
              {t("survey.close")}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
