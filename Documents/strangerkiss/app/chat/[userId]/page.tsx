"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import type { Message } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { translateText, AlreadyInTargetLanguageError } from "@/lib/translate";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useNotifications } from "@/lib/notificationContext";

// Special message markers
const SK_MEETING_REQUEST  = "┬ºMEETING_REQUEST┬º";
const SK_MEETING_ACCEPTED = "┬ºMEETING_ACCEPTED┬º";
const SK_MEETING_REFUSED  = "┬ºMEETING_REFUSED┬º";


function isImageMsg(content: string) {
  return content.startsWith("data:image/");
}

function formatTime(iso: string, bcp47: string) {
  return new Date(iso).toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit" });
}

// Compress image to JPEG, max 800px on the longest side
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load failed")); };
    img.src = url;
  });
}


export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, bcp47, locale } = useI18n();

  const otherId = params.userId as string;
  const otherName = searchParams.get("name") ?? "Inconnu┬Àe";
  const otherAppearance = searchParams.get("appearance") ?? "";

  const { setActiveChatId } = useNotifications();

  const [myId, setMyId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [reported, setReported] = useState(false);
  // null = v├®rification en cours, true/false = r├®sultat connu
  const [isBeta, setIsBeta] = useState<boolean | null>(null);

  // Translation state per message id
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChat = useCallback(async (id: string) => {
    // Chargement de l'historique via MySQL
    const res = await fetch(`/api/db/messages?from=${id}&to=${otherId}`);
    if (!res.ok) {
      // Fallback d├®mo si l'API n'est pas disponible
      const tr = tRef.current;
      setDemoMode(true);
      setMessages([
        { id: "d1", from_id: otherId, to_id: id, content: tr("chat.demo1"), created_at: new Date(Date.now() - 120000).toISOString() },
        { id: "d2", from_id: id, to_id: otherId, content: tr("chat.demo2"), created_at: new Date(Date.now() - 90000).toISOString() },
        { id: "d3", from_id: otherId, to_id: id, content: SK_MEETING_REQUEST, created_at: new Date(Date.now() - 30000).toISOString() },
      ]);
      return;
    }
    const { messages: history } = await res.json();
    setMessages(history ?? []);

    // Polling toutes les 3 secondes pour les nouveaux messages (remplace Supabase realtime)
    const interval = setInterval(async () => {
      setMessages((prev) => {
        const since = prev.length > 0 ? prev[prev.length - 1].created_at : new Date(0).toISOString();
        fetch(`/api/db/messages?from=${id}&to=${otherId}&since=${encodeURIComponent(since)}`)
          .then((r) => r.json())
          .then(({ messages: newMsgs }) => {
            if (newMsgs?.length > 0) {
              // D├®dupliquer par ID ÔÇö ├®vite le double affichage du selfie quand le poll
              // capture son `since` avant que pushMessage ait mis ├á jour l'├®tat.
              setMessages((p) => {
                const existingIds = new Set(p.map((m) => m.id));
                const truly_new = (newMsgs as typeof p).filter((m) => !existingIds.has(m.id));
                return truly_new.length > 0 ? [...p, ...truly_new] : p;
              });
            }
          })
          .catch(() => {});
        return prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [otherId]);

  useEffect(() => {
    setActiveChatId(otherId);
    let unsub: (() => void) | undefined;
    try {
      const stored = localStorage.getItem("sk_my_id");
      const id = stored ?? crypto.randomUUID();
      setMyId(id);
      loadChat(id).then((fn) => { unsub = fn; });

      // V├®rification b├¬ta-testeur
      // Strat├®gie double : par sk_phone (direct) + sk_user_id (fallback si phone absent/format├® diff├®remment)
      const phone  = localStorage.getItem("sk_phone");
      const userId = localStorage.getItem("sk_user_id");
      if (phone || userId) {
        const params = new URLSearchParams();
        if (phone)  params.set("phone",   phone);
        if (userId) params.set("user_id", userId);
        fetch(`/api/beta/check?${params}`)
          .then((r) => r.json())
          .then(({ is_beta }) => setIsBeta(!!is_beta))
          .catch(() => setIsBeta(false));
      } else {
        setIsBeta(false);
      }
    } catch {
      const id = crypto.randomUUID();
      setMyId(id);
      loadChat(id).then((fn) => { unsub = fn; });
      setIsBeta(false);
    }
    return () => {
      unsub?.();
      setActiveChatId(null);
    };
  }, [loadChat, otherId, setActiveChatId]);

  // ÔöÇÔöÇ Send helpers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  async function pushMessage(content: string, id = myId) {
    if (!id) return;
    if (demoMode) {
      const msg: Message = {
        id: crypto.randomUUID(),
        from_id: id,
        to_id: otherId,
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, msg]);
      return msg;
    }
    const res = await fetch("/api/db/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_id: id, to_id: otherId, content }),
    });
    const { message: sent } = await res.json();
    if (sent) setMessages((prev) => [...prev, sent]);
    return sent;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !myId || sending) return;
    setInput("");
    setSending(true);
    await pushMessage(text);
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ÔöÇÔöÇ Selfie ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  async function handleSelfieFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setSending(true);
    try {
      const dataUrl = await compressImage(file);
      await pushMessage(dataUrl);
    } catch {
      alert(tRef.current("chat.selfieError"));
    } finally {
      setSending(false);
    }
  }

  // ÔöÇÔöÇ Meeting request ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  async function handleSendMeetingRequest() {
    if (!myId || sending) return;
    setSending(true);
    await pushMessage(SK_MEETING_REQUEST);
    // Enregistrer la demande en base (best-effort)
    fetch("/api/matches/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requester_id: myId, target_id: otherId }),
    }).catch(() => {});
    setSending(false);
  }

  async function handleMeetingResponse(accept: boolean) {
    if (!myId) return;
    const content = accept ? SK_MEETING_ACCEPTED : SK_MEETING_REFUSED;
    await pushMessage(content);
    if (accept) {
      // otherId est le demandeur, myId est le destinataire
      fetch("/api/matches/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_id: otherId, target_id: myId }),
      }).catch(() => {});
    } else {
      // Refus : blocage sym├®trique en base (les deux profils disparaissent mutuellement)
      fetch("/api/matches/refuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_id: otherId, target_id: myId }),
      }).catch(() => {});
    }
    // D├®clencher l'enqu├¬te post-exp├®rience (une seule fois)
    try {
      const surveyDone    = localStorage.getItem("sk_survey_done");
      const surveyPending = localStorage.getItem("sk_survey_pending");
      console.log(
        "[chat] handleMeetingResponse ÔûÂ",
        "accept:", accept,
        "| sk_survey_done:", surveyDone,
        "| sk_survey_pending (avant):", surveyPending,
        "| myId:", myId?.slice(0, 8),
        "| otherId:", otherId?.slice(0, 8),
      );
      if (surveyDone !== "true") {
        localStorage.setItem("sk_survey_pending", "true");
        console.log("[chat] Ô£ô sk_survey_pending pos├® ÔÇö dispatch sk:survey_check");
        // Notifier MapClient s'il est d├®j├á mont├® en m├®moire (router cache Next.js).
        // Si MapClient est fresh-mounted, son useEffect de mount lira sk_survey_pending.
        const dispatched = window.dispatchEvent(new Event("sk:survey_check"));
        console.log("[chat] dispatchEvent sk:survey_check ÔÇö dispatched:", dispatched,
          "| sk_survey_pending (apr├¿s):", localStorage.getItem("sk_survey_pending"),
        );
      } else {
        console.log("[chat] survey d├®j├á effectu├® (sk_survey_done=true) ÔÇö rien ├á faire");
      }
    } catch (err) {
      console.error("[chat] handleMeetingResponse survey block ERROR:", err);
    }
  }

  // ÔöÇÔöÇ Report ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  async function handleReport() {
    if (!myId || reported) return;
    const confirmed = window.confirm(t("chat.reportConfirm", { name: otherName }));
    if (!confirmed) return;
    try {
      const res = await fetch("/api/moderation/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporter_pin_id: myId, reported_pin_id: otherId }),
      });
      const { action } = await res.json();
      if (action === "already_reported") {
        alert(t("chat.reportAlready"));
      } else {
        setReported(true);
        alert(t("chat.reportSent"));
      }
    } catch {
      alert(t("chat.reportError"));
    }
  }

  // ÔöÇÔöÇ Translation ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  async function handleTranslate(msgId: string, content: string) {
    if (translations[msgId]) {
      setTranslations((prev) => { const n = { ...prev }; delete n[msgId]; return n; });
      return;
    }
    setTranslating((prev) => ({ ...prev, [msgId]: true }));
    try {
      const result = await translateText(content, locale);
      setTranslations((prev) => ({ ...prev, [msgId]: result }));
    } catch (err) {
      if (err instanceof AlreadyInTargetLanguageError) {
        setTranslations((prev) => ({ ...prev, [msgId]: `ÔÇö ${tRef.current("chat.alreadyTranslated")} ÔÇö` }));
      }
    } finally {
      setTranslating((prev) => { const n = { ...prev }; delete n[msgId]; return n; });
    }
  }

  // ÔöÇÔöÇ Render one message ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  function renderMessage(msg: Message) {
    const isMe = msg.from_id === myId;
    const translated = translations[msg.id];
    const isTranslating = translating[msg.id];

    // Avertissement de mod├®ration (envoy├® par le syst├¿me ├á l'utilisateur signal├®)
    if (msg.content === "┬ºMODERATION_WARNING┬º") {
      return (
        <div key={msg.id} className="flex justify-center">
          <div className="max-w-[90%] px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 text-center">
            {t("chat.moderationWarning")}
          </div>
        </div>
      );
    }

    // Meeting request card
    if (msg.content === SK_MEETING_REQUEST) {
      if (isMe) {
        return (
          <div key={msg.id} className="flex justify-end">
            <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-[#e91e8c]/20 border border-[#e91e8c]/30 text-sm text-white/80 text-center">
              ­ƒÆ× {t("chat.meetingRequestSent", { name: otherName })}
              <p className="text-[10px] text-white/40 mt-1">{formatTime(msg.created_at, bcp47)}</p>
            </div>
          </div>
        );
      }
      // Received ÔÇö show Accept/Refuse buttons
      return (
        <div key={msg.id} className="flex justify-start">
          <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-sm bg-[#7c3aed]/20 border border-[#7c3aed]/30 text-sm text-center space-y-3">
            <p className="text-white/90">­ƒÆ× {t("chat.meetingRequestReceived", { name: otherName })}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleMeetingResponse(true)}
                className="flex-1 py-2 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-medium hover:bg-green-500/30 transition-colors"
              >
                {t("chat.accept")}
              </button>
              <button
                onClick={() => handleMeetingResponse(false)}
                className="flex-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-medium hover:bg-red-500/25 transition-colors"
              >
                {t("chat.refuse")}
              </button>
            </div>
            <p className="text-[10px] text-white/30">{formatTime(msg.created_at, bcp47)}</p>
          </div>
        </div>
      );
    }

    // Meeting accepted / refused
    if (msg.content === SK_MEETING_ACCEPTED || msg.content === SK_MEETING_REFUSED) {
      const accepted = msg.content === SK_MEETING_ACCEPTED;
      return (
        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
          <div className={`px-4 py-2 rounded-2xl text-sm font-medium ${
            accepted
              ? "bg-green-500/15 border border-green-500/25 text-green-300"
              : "bg-red-500/10 border border-red-500/20 text-red-300"
          }`}>
            {accepted ? t("chat.meetingAccepted") : t("chat.meetingRefused")}
            <span className="block text-[10px] opacity-50 mt-0.5">{formatTime(msg.created_at, bcp47)}</span>
          </div>
        </div>
      );
    }

    // Image (selfie)
    if (isImageMsg(msg.content)) {
      return (
        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[60%] rounded-2xl overflow-hidden border ${isMe ? "border-[#e91e8c]/40 rounded-br-sm" : "border-white/15 rounded-bl-sm"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={msg.content} alt="selfie" className="block w-full max-h-[200px] object-cover" />
            <p className={`text-[10px] px-2 py-1 ${isMe ? "text-right text-[#e91e8c]/60" : "text-white/30"}`}>
              {formatTime(msg.created_at, bcp47)}
            </p>
          </div>
        </div>
      );
    }

    // Regular text message
    return (
      <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isMe ? "bg-[#e91e8c] text-white rounded-br-sm" : "bg-white/10 text-white/90 rounded-bl-sm"
        }`}>
          <p>{msg.content}</p>
          <div className={`flex items-center gap-2 mt-1 ${isMe ? "justify-end" : "justify-between"}`}>
            <p className={`text-[10px] ${isMe ? "text-white/60" : "text-white/30"}`}>
              {formatTime(msg.created_at, bcp47)}
            </p>
            {!isMe && (
              <button
                onClick={() => handleTranslate(msg.id, msg.content)}
                disabled={isTranslating}
                className={`text-[10px] flex items-center gap-0.5 transition-colors rounded px-1 py-0.5 ${
                  translated ? "text-[#a78bfa] bg-[#7c3aed]/20" : "text-white/25 hover:text-white/50"
                }`}
                title={t("chat.translate")}
              >
                {isTranslating ? <span className="animate-pulse">ÔÅ│</span> : <>­ƒîÉ {translated ? "├ù" : t("chat.translate")}</>}
              </button>
            )}
          </div>
        </div>
        {!isMe && translated && (
          <div className="max-w-[75%] mt-1 px-4 py-2 rounded-2xl rounded-tl-sm bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-xs text-[#c4b5fd] leading-relaxed">
            {translated}
          </div>
        )}
      </div>
    );
  }

  // Chat d├®sactiv├® jusqu'au lancement (26 mai 2026) ÔÇö sauf pour les b├¬ta-testeurs
  const LAUNCH_DATE = new Date("2026-05-26T00:00:00Z");
  const isPrelaunch = Date.now() < LAUNCH_DATE.getTime();

  // Attendre la r├®ponse de la v├®rification b├¬ta avant de rendre le verrou
  if (isPrelaunch && isBeta === null) {
    return (
      <main className="flex flex-col w-full overflow-x-hidden items-center justify-center" style={{ height: "100dvh" }}>
        <div className="text-4xl animate-pulse">ÔÅ│</div>
      </main>
    );
  }

  if (isPrelaunch && isBeta === false) {
    return (
      <main className="flex flex-col w-full overflow-x-hidden" style={{ height: "100dvh" }}>
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            aria-label={t("chat.back")}
          >
            ÔåÉ
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm truncate">{otherName}</div>
          </div>
          <LanguageSwitcher />
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="text-5xl">­ƒöÆ</div>
          <h2 className="text-xl font-bold text-white">{t("chat.comingSoon")}</h2>
          <p className="text-sm text-white/50 max-w-xs leading-relaxed">
            {t("chat.comingSoonDesc", { date: "9 mai 2026" })}
          </p>
          <a
            href="/"
            className="mt-2 bg-[#e91e8c] hover:bg-[#c2186f] text-white text-sm font-semibold px-6 py-3 rounded-full transition-all shadow-[0_0_20px_rgba(233,30,140,0.3)]"
          >
            {t("chat.comingSoonCta")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col w-full overflow-x-hidden" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center text-white/50 hover:text-white transition-colors rounded-xl hover:bg-white/10 text-lg"
          aria-label={t("chat.back")}
        >
          ÔåÉ
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{otherName}</div>
          {otherAppearance && (
            <div className="text-xs text-[#e91e8c]/70 truncate">­ƒæÇ {otherAppearance}</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {demoMode && (
            <span className="text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1">
              {t("chat.demoMode")}
            </span>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      {/* Demo banner */}
      {demoMode && (
        <div className="flex-shrink-0 px-4 py-2.5 bg-amber-400/5 border-b border-amber-400/10 text-xs text-amber-400/60 text-center">
          {t("chat.demoBanner")}
        </div>
      )}

      {/* Messages ÔÇö min-h-0 requis pour que flex-1 ne force pas la hauteur */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-5xl">­ƒÆî</div>
            <p className="text-white/40 text-sm">{t("chat.greeting", { name: otherName })}</p>
          </div>
        )}
        {messages.map(renderMessage)}
        <div ref={bottomRef} />
      </div>

      {/* Action bar */}
      <div className="flex-shrink-0 border-t border-white/5 bg-white/[0.02]">
        {/* Meeting request + selfie + report */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <div className="flex gap-2 flex-1 min-w-0 overflow-x-auto">
            <button
              onClick={handleSendMeetingRequest}
              disabled={sending}
              className="flex-shrink-0 text-xs text-[#e91e8c]/70 hover:text-[#e91e8c] bg-[#e91e8c]/10 hover:bg-[#e91e8c]/20 border border-[#e91e8c]/20 rounded-full px-3 py-1.5 transition-all disabled:opacity-40"
            >
              {t("chat.meetingRequest")}
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={sending}
              className="flex-shrink-0 text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-3 py-1.5 transition-all disabled:opacity-40"
            >
              {t("chat.selfie")}
            </button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleSelfieFile}
            />
          </div>
          <button
            onClick={handleReport}
            disabled={reported}
            className="flex-shrink-0 text-xs text-white/25 hover:text-red-400 bg-transparent border-none rounded-full px-2 py-1.5 transition-all disabled:opacity-30"
            title={t("chat.report")}
          >
            ­ƒÜ®
          </button>
        </div>

        {/* Text input ÔÇö min-w-0 sur l'input pour qu'il ne d├®passe pas en flex */}
        <div className="px-4 py-3 flex gap-2 items-end">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.inputPlaceholder", { name: otherName })}
            maxLength={500}
            disabled={sending}
            style={{ fontSize: "16px" }}
            className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/50 focus:ring-2 focus:ring-[#e91e8c]/15 transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_0_16px_rgba(233,30,140,0.35)]"
            aria-label={t("chat.send")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}
