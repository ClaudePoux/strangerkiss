"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useNotifications } from "@/lib/notificationContext";
import type { SKNotification, NotificationType } from "@/lib/notificationContext";

const DEMO_NOTIFICATIONS = [
  "Sophie vous a envoyé un message",
  "Lucas vous envoie une demande de rencontre",
  "Votre rencontre avec Emma a été acceptée !",
  "3 nouveaux utilisateurs près de vous",
  "Vous avez reçu 5 crédits !",
  "Votre profil expire dans 2 minutes",
];

const ICONS: Record<NotificationType, string> = {
  new_message:      "💬",
  meeting_request:  "💌",
  meeting_accepted: "💞",
  meeting_refused:  "😔",
  credits_low:      "⚠️",
  credits_received: "🎁",
  verified:         "✅",
  match:            "🔥",
  info:             "ℹ️",
};

function getLabel(n: SKNotification): string {
  switch (n.type) {
    case "new_message":      return `${n.senderName} vous a envoyé un message`;
    case "meeting_request":  return `${n.senderName} veut vous rencontrer`;
    case "meeting_accepted": return `${n.senderName} a accepté la rencontre !`;
    case "meeting_refused":  return `${n.senderName} a refusé`;
    case "credits_low":      return "Il ne vous reste plus que 1 crédit";
    case "credits_received": return n.label ?? "Crédits reçus";
    case "verified":         return "Téléphone vérifié — 3 crédits offerts !";
    case "match":            return `Match avec ${n.senderName} !`;
    case "info":             return n.label ?? "";
  }
}

function getChatUrl(n: SKNotification): string | null {
  if (!n.senderId) return null;
  const chatTypes: NotificationType[] = ["new_message", "meeting_request", "meeting_accepted", "meeting_refused", "match"];
  if (!chatTypes.includes(n.type)) return null;
  return `/chat/${n.senderId}?name=${encodeURIComponent(n.senderName ?? "")}&appearance=${encodeURIComponent(n.senderAppearance ?? "")}`;
}

// Auto-dismiss delay in ms (non-persistent notifications)
const AUTO_DISMISS_MS = 10000;

export default function NotificationBar({ demoMode }: { demoMode?: boolean }) {
  const { notifications, dismiss } = useNotifications();
  const [demoIndex, setDemoIndex] = useState(0);
  const current = notifications[0] ?? null;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cycle démo — actif uniquement si demoMode=true
  useEffect(() => {
    if (!demoMode) return;
    const interval = setInterval(() => {
      setDemoIndex((i) => (i + 1) % DEMO_NOTIFICATIONS.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [demoMode]);

  // Auto-dismiss des notifications réelles
  useEffect(() => {
    if (demoMode) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!current || current.persistent) return;
    timerRef.current = setTimeout(() => dismiss(current.id), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, current?.id, current?.persistent]);

  const chatUrl = current ? getChatUrl(current) : null;

  if (demoMode) {
    return (
      <div
        style={{ height: "40px", flexShrink: 0, overflow: "hidden" }}
        className="flex items-center px-4 border-b border-white/5 bg-[#12122a]"
      >
        <span className="flex-1 min-w-0 text-xs text-white/80 truncate">
          {DEMO_NOTIFICATIONS[demoIndex]}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{ height: "40px", flexShrink: 0, overflow: "hidden" }}
      className="flex items-center px-4 border-b border-white/5 bg-[#12122a]"
    >
      {current && (
        <>
          <span className="text-base mr-2 flex-shrink-0 leading-none">{ICONS[current.type]}</span>
          {chatUrl ? (
            <Link
              href={chatUrl}
              onClick={() => dismiss(current.id)}
              className="flex-1 min-w-0 text-xs text-white/80 hover:text-white truncate"
            >
              {getLabel(current)}
            </Link>
          ) : (
            <span className="flex-1 min-w-0 text-xs text-white/80 truncate">{getLabel(current)}</span>
          )}
          <button
            onClick={() => dismiss(current.id)}
            className="flex-shrink-0 ml-2 text-white/30 hover:text-white/60 transition-colors text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
