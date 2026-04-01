"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import type { Message } from "@/lib/supabase";

// Demo messages shown when Supabase is not configured
const DEMO_MESSAGES: Message[] = [
  {
    id: "d1",
    from_id: "demo-0",
    to_id: "me",
    content: "Hey ! Je t'ai vu sur la carte 😊",
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: "d2",
    from_id: "me",
    to_id: "demo-0",
    content: "Salut ! Tu es encore dans le coin ?",
    created_at: new Date(Date.now() - 90000).toISOString(),
  },
  {
    id: "d3",
    from_id: "demo-0",
    to_id: "me",
    content: "Oui, je suis à la terrasse du café central, veste rouge 😉",
    created_at: new Date(Date.now() - 60000).toISOString(),
  },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const otherId = params.userId as string;
  const otherName = searchParams.get("name") ?? "Inconnu·e";
  const otherAppearance = searchParams.get("appearance") ?? "";

  const [myId, setMyId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChat = useCallback(async (id: string) => {
    const { supabase, getMessages, subscribeToMessages } = await import("@/lib/supabase");

    if (!supabase) {
      setDemoMode(true);
      setMessages(DEMO_MESSAGES.map((m) => ({ ...m, from_id: m.from_id === "me" ? id : otherId, to_id: m.to_id === "me" ? id : otherId })));
      return;
    }

    const history = await getMessages(id, otherId);
    setMessages(history);

    // Real-time subscription
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
      // Optimistic local add in demo mode
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
    if (sent) {
      setMessages((prev) => [...prev, sent]);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <button
          onClick={() => router.back()}
          className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          aria-label="Retour"
        >
          ←
        </button>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{otherName}</div>
          {otherAppearance && (
            <div className="text-xs text-[#e91e8c]/70 truncate">👀 {otherAppearance}</div>
          )}
        </div>

        {demoMode && (
          <span className="flex-shrink-0 text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1">
            Mode démo
          </span>
        )}
      </header>

      {/* Demo banner */}
      {demoMode && (
        <div className="px-4 py-2.5 bg-amber-400/5 border-b border-amber-400/10 text-xs text-amber-400/60 text-center">
          Messages locaux uniquement — connecte Supabase pour le chat en temps réel
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="text-5xl">💌</div>
            <p className="text-white/40 text-sm">
              Dis bonjour à <strong className="text-white/60">{otherName}</strong> !
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.from_id === myId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? "bg-[#e91e8c] text-white rounded-br-sm"
                    : "bg-white/10 text-white/90 rounded-bl-sm"
                }`}
              >
                <p>{msg.content}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    isMe ? "text-white/60 text-right" : "text-white/30"
                  }`}
                >
                  {formatTime(msg.created_at)}
                </p>
              </div>
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
          placeholder={`Écrire à ${otherName}…`}
          maxLength={500}
          disabled={sending}
          className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#e91e8c]/50 focus:ring-2 focus:ring-[#e91e8c]/15 transition-all text-sm disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-2xl bg-[#e91e8c] hover:bg-[#c2186f] disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-[0_0_16px_rgba(233,30,140,0.35)]"
          aria-label="Envoyer"
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
