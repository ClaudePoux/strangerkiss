"use client";

import { useState } from "react";

interface Props {
  t: (key: string, params?: Record<string, string>) => string;
  onClose: () => void;
}

type Gender = "homme" | "femme" | "autre";
type Travel = "seul" | "couple" | "les_deux";
type Step = "q1" | "q2" | "result";

function getMsgKey(gender: Gender | null, travel: Travel | null): string {
  if (travel === "couple") return "survey.msgCouple";
  if (gender === "femme") return "survey.msgWomanAlone";
  if (gender === "homme" && travel === "seul") return "survey.msgManAlone";
  return "survey.msgDefault";
}

export default function SurveyModal({ t, onClose }: Props) {
  const [step, setStep] = useState<Step>("q1");
  const [gender, setGender] = useState<Gender | null>(null);
  const [travel, setTravel] = useState<Travel | null>(null);

  function handleGender(g: Gender) {
    setGender(g);
    setStep("q2");
  }

  function handleTravel(tr: Travel) {
    setTravel(tr);
    // Persister
    try {
      localStorage.setItem("sk_survey_done", "true");
      localStorage.removeItem("sk_survey_pending");
      const userId = localStorage.getItem("sk_user_id");
      if (userId) {
        fetch("/api/survey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, gender_survey: gender, travel_situation: tr }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }

    setStep("result");
  }

  const btnClass =
    "py-3 rounded-xl bg-white/5 hover:bg-[#e91e8c]/15 border border-white/10 hover:border-[#e91e8c]/30 text-white/80 hover:text-white text-sm transition-all active:scale-95";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl">

        {step === "q1" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-3xl">💞</div>
              <h2 className="text-lg font-bold text-white">{t("survey.title")}</h2>
              <p className="text-xs text-white/40">{t("survey.subtitle")}</p>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-white/70 font-medium">{t("survey.q1")}</p>
              <div className="flex flex-col gap-2">
                <button className={btnClass} onClick={() => handleGender("homme")}>{t("survey.q1man")}</button>
                <button className={btnClass} onClick={() => handleGender("femme")}>{t("survey.q1woman")}</button>
                <button className={btnClass} onClick={() => handleGender("autre")}>{t("survey.q1other")}</button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full text-xs text-white/20 hover:text-white/40 transition-colors py-1"
            >
              {t("survey.skip")}
            </button>
          </div>
        )}

        {step === "q2" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-3xl">✈️</div>
              <h2 className="text-lg font-bold text-white">{t("survey.q2")}</h2>
            </div>
            <div className="flex flex-col gap-2">
              <button className={btnClass} onClick={() => handleTravel("seul")}>{t("survey.q2alone")}</button>
              <button className={btnClass} onClick={() => handleTravel("couple")}>{t("survey.q2couple")}</button>
              <button className={btnClass} onClick={() => handleTravel("les_deux")}>{t("survey.q2both")}</button>
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="space-y-6 text-center">
            <div className="text-3xl">🎉</div>
            <h2 className="text-lg font-bold text-white">{t("survey.thankYou")}</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              {t(getMsgKey(gender, travel))}
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
