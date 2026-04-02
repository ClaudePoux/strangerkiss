"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import type { Message } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { translateText, AlreadyInTargetLanguageError } from "@/lib/translate";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function formatTime(iso: string, bcp47: string) {
  return new Date(iso).toLocaleTimeString(bcp47, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, bcp47, locale } = useI18n();

  const otherId = params.userId as string;
  const otherName = searchParams.get("name") ?? "Inconnu·e";
  const otherAppearance = searchParams.get("appearance") ?? "";

  const [myId, setMyId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Translation state per message id
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChat = useCallback(async (id: string) => {
    const { supabase, getMessages, subscribeToMessages } = await import("@/lib/supabase");

    if (!supabase) {
      const tr = tRef.current;
      setDemoMode(true);
      setMessages([
        { id: "d1", from_id: otherId, to_id: id, content: tr("chat.demo1"), created_at: new Date(Date.now() - 120000).toISOString() },
        { id: "d2", from_id: id, to_id: otherId, content: tr("chat.demo2"), created_at: new Date(Date.now() - 90000).toISOString() },
        { id: "d3", from_id: otherId, to_id: id, content: tr("chat.demo3"), created_at: new Date(Date.now() - 60000).toISOString() },
      ]);
      return;
    }

    const history = await getMessages(id, otherId);
    setMessages(history);

    const unsub = subscribeToMessages(id, otherId, (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return unsub;
  }, [otherId]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const stored = localStorage.getItem("sk_my_id");
      const id = stored ?? crypto.randomUUID();
      setMyId(id);
      loadChat(id).then((fn) => { unsub = fn; });
    } catch {
      const id = crypto.randomUUID();
      setMyId(id);
      loadChat(id).then((fn) => { unsub = fn; });
    }
    return () => unsub?.();
  }, [loadChat]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !myId) return;
    setInput("");
    setSending(true);

    if (demoMode) {
      const fakeMsg: Message = {
        id: crypto.randomUUID(),
        from_id: myId,
        to_id: otherId,
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fakeMsg]);
      setSending(false);
      inputRef.current?.focus();
      return;
    }

    const { sendMessage } = await import("@/lib/supabase");
    const sent = await sendMessage(myId, otherId, text);
    if (sent) setMessages((prev) => [...prev, sent]);
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleTranslate(msgId: string, content: string) {
    // Toggle off if already translated
    if (translations[msgId]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      return;
    }

    setTranslating((prev) => ({ ...prev, [msgId]: true }));
    try {
      const result = await translateText(content, locale);
      setTranslations((prev) => ({ ...prev, [msgId]: result }));
    } catch (err) {
      if (err instanceof AlreadyInTargetLanguageError) {
        setTranslations((prev) => ({
          ...prev,
          [msgId]: `— ${tRef.current("chat.alreadyTranslated")} —`,
        }));
      }
      // silently ignore other errors
    } finally {
      setTranslating((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
    }
  }

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <button
          onClick={() => router.back()}
          className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          aria-label={t("chat.back")}
        >
          ←
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{otherName}</div>
          {otherAppearance && (
            <div className="text-xs text-[#e91e8c]/70 truncate">👀 {otherAppearance}</div>
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
        <div className="px-4 py-2.5 bg-amber-400/5 border-b border-amber-400/10 text-xs text-amber-400/60 text-center">
          {t("chat.demoBanner")}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-5xl">💌</div>
            <p className="text-white/40 text-sm">
              {t("chat.greeting", { name: otherName })}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.from_id === myId;
          const translated = translations[msg.id];
          const isTranslating = translating[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              {/* Message bubble */}
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? "bg-[#e91e8c] text-white rounded-br-sm"
                    : "bg-white/10 text-white/90 rounded-bl-sm"
                }`}
              >
                <p>{msg.content}</p>
                <div className={`flex items-center gap-2 mt-1 ${isMe ? "justify-end" : "justify-between"}`}>
                  <p className={`text-[10px] ${isMe ? "text-white/60" : "text-white/30"}`}>
                    {formatTime(msg.created_at, bcp47)}
                  </p>
                  {/* Translate button — only on incoming messages */}
                  {!isMe && (
                    <button
                      onClick={() => handleTranslate(msg.id, msg.content)}
                      disabled={isTranslating}
                      className={`text-[10px] flex items-center gap-0.5 transition-colors rounded px-1 py-0.5 ${
                        translated
                          ? "text-[#a78bfa] bg-[#7c3aed]/20"
                          : "text-white/25 hover:text-white/50"
                      }`}
                      title={t("chat.translate")}
                    >
                      {isTranslating ? (
                        <span className="animate-pulse">⏳</span>
                      ) : (
                        <>🌐 {translated ? "×" : t("chat.translate")}</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Translation bubble */}
              {!isMe && translated && (
                <div className="max-w-[75%] mt-1 px-4 py-2 rounded-2xl rounded-tl-sm bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-xs text-[#c4b5fd] leading-relaxed">
                  {translated}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/5 px-4 py-3 flex gap-3 items-end bg-white/[0.02]">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.inputPlaceholder", { name: otherName })}
          maxLength={500}
          disabled={sending}
          className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/50 focus:ring-2 focus:ring-[#e91e8c]/15 transition-all text-sm disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-[0_0_16px_rgba(233,30,140,0.35)]"
          aria-label={t("chat.send")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </main>
  );
}
