"use client";

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useState,
} from "react";
import { useNotifications } from "@/lib/useNotifications";
import type { Notif, NotifType } from "@/lib/useNotifications";
import { useI18n } from "@/lib/i18n";

interface NotificationContextValue {
  notifs: Notif[];
  push: (n: Omit<Notif, "id">) => string;
  dismiss: (id: string) => void;
  dismissType: (type: NotifType) => void;
  /** Enregistre le chat actif — inbox ignore les messages de cet expéditeur. */
  setActiveChatId: (id: string | null) => void;
  /** Crédits courants (mis à jour par polling + mises à jour immédiates). */
  credits: number | null;
  /** Mise à jour immédiate des crédits (inscription, vérification téléphone). */
  updateCredits: (c: number) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotificationContext must be inside NotificationProvider");
  return ctx;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { notifs, push, dismiss, dismissType } = useNotifications();
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  // Chat actif — les messages de cet expéditeur n'affichent pas de notification
  const activeChatIdRef = useRef<string | null>(null);
  // Curseur inbox : timestamp du dernier message déjà traité
  const inboxSinceRef = useRef<string>(new Date().toISOString());
  // Crédits précédents pour le calcul de diff
  const prevCreditsRef = useRef<number | null>(null);

  const [myId, setMyId] = useState("");
  const [userId, setUserId] = useState("");
  const [credits, setCredits] = useState<number | null>(null);

  const updateCredits = useCallback((c: number) => {
    setCredits(c);
    prevCreditsRef.current = c;
    try { localStorage.setItem("sk_user_credits", String(c)); } catch { /* ignore */ }
  }, []);

  const setActiveChatId = useCallback((id: string | null) => {
    activeChatIdRef.current = id;
    // Avancer le curseur pour ignorer les messages envoyés pendant l'ouverture du chat
    inboxSinceRef.current = new Date().toISOString();
  }, []);

  // Lecture initiale depuis localStorage + écoute des mises à jour de MapClient
  useEffect(() => {
    try {
      const id = localStorage.getItem("sk_my_id");
      if (id) setMyId(id);
      const uid = localStorage.getItem("sk_user_id");
      if (uid) {
        setUserId(uid);
        const cached = localStorage.getItem("sk_user_credits");
        if (cached !== null) {
          const c = parseInt(cached, 10);
          setCredits(c);
          prevCreditsRef.current = c;
        }
      }
    } catch { /* ignore */ }

    function onIdsUpdate(e: Event) {
      const detail = (e as CustomEvent<{ myId?: string; userId?: string; credits?: number }>).detail ?? {};
      if (detail.myId) setMyId(detail.myId);
      if (detail.userId) {
        setUserId(detail.userId);
        try {
          const cached = localStorage.getItem("sk_user_credits");
          if (cached !== null && prevCreditsRef.current === null) {
            const c = parseInt(cached, 10);
            setCredits(c);
            prevCreditsRef.current = c;
          }
        } catch { /* ignore */ }
      }
      if (detail.credits !== undefined) {
        setCredits(detail.credits);
        prevCreditsRef.current = detail.credits;
      }
    }
    window.addEventListener("sk:ids_update", onIdsUpdate);
    return () => window.removeEventListener("sk:ids_update", onIdsUpdate);
  }, []);

  // Polling inbox toutes les 10 s — filtre le chat actif pour éviter les doublons
  useEffect(() => {
    if (!myId) return;
    const interval = setInterval(async () => {
      try {
        const since = inboxSinceRef.current;
        inboxSinceRef.current = new Date().toISOString();
        const res = await fetch(
          `/api/db/messages?inbox=${encodeURIComponent(myId)}&since=${encodeURIComponent(since)}`
        );
        if (!res.ok) return;
        const { messages } = await res.json();
        if (!messages?.length) return;

        for (const msg of messages) {
          const senderId: string = msg.from_id;
          // Ignorer les messages du chat actuellement ouvert
          if (activeChatIdRef.current === senderId) continue;

          let senderName = tRef.current("notif.someone");
          let senderAppearance = "";
          try {
            const pr = await fetch(`/api/db/pins?pin_id=${encodeURIComponent(senderId)}`);
            if (pr.ok) {
              const { pin } = await pr.json();
              if (pin?.name) senderName = pin.name;
              if (pin?.appearance) senderAppearance = pin.appearance;
            }
          } catch { /* ignore */ }

          const chatUrl = `/chat/${senderId}?name=${encodeURIComponent(senderName)}&appearance=${encodeURIComponent(senderAppearance)}`;

          if (msg.message_type === "meeting_request") {
            push({ type: "meeting_request", text: tRef.current("notif.meetingRequest", { name: senderName }), href: chatUrl, persistent: false });
          } else if (msg.message_type === "meeting_accepted") {
            push({ type: "meeting_accepted", text: tRef.current("notif.meetingAccepted", { name: senderName }), href: chatUrl, persistent: false });
          } else if (msg.message_type === "moderation_warning") {
            push({ type: "moderation_warning", text: tRef.current("notif.moderationWarning"), persistent: true });
          } else {
            push({ type: "message", text: tRef.current("notif.newMessage", { name: senderName }), href: chatUrl, persistent: false });
          }
        }
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(interval);
  }, [myId, push]);

  // Polling crédits toutes les 30 s — détecte low_credits, no_credits, credits_received
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/credits/balance?user_id=${userId}`);
        if (!res.ok) return;
        const { credits: c } = await res.json();
        if (c == null) return;
        setCredits(c);
        try { localStorage.setItem("sk_user_credits", String(c)); } catch { /* ignore */ }

        const prev = prevCreditsRef.current;
        if (prev !== null && c !== prev) {
          if (c === 0) {
            push({ type: "no_credits", text: tRef.current("notif.noCredits"), href: "/credits", persistent: true });
          } else if (c < 2 && prev >= 2) {
            push({ type: "low_credits", text: tRef.current("notif.lowCredits", { count: String(c) }), href: "/credits", persistent: true });
          } else if (c > prev) {
            push({ type: "credits_received", text: tRef.current("notif.creditsReceived", { count: String(c - prev) }), persistent: false });
          }
        }
        prevCreditsRef.current = c;
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [userId, push]);

  return (
    <NotificationContext.Provider
      value={{ notifs, push, dismiss, dismissType, setActiveChatId, credits, updateCredits }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
