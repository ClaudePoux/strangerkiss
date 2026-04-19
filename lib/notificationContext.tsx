"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

export type NotificationType =
  | "new_message"
  | "meeting_request"
  | "meeting_accepted"
  | "meeting_refused"
  | "credits_low"
  | "credits_received"
  | "verified"
  | "match"
  | "info";

export interface SKNotification {
  id: string;
  type: NotificationType;
  senderId?: string;
  senderName?: string;
  senderAppearance?: string;
  label?: string;
  persistent?: boolean;
  createdAt: number;
}

interface NotificationContextValue {
  notifications: SKNotification[];
  unreadCounts: Record<string, number>;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  dismiss: (id: string) => void;
  push: (n: Omit<SKNotification, "id" | "createdAt">) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCounts: {},
  activeChatId: null,
  setActiveChatId: () => {},
  dismiss: () => {},
  push: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<SKNotification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null);

  const activeChatIdRef = useRef<string | null>(null);
  // Cursor: only fetch messages newer than this timestamp
  const inboxSinceRef = useRef<string>(new Date().toISOString());

  const setActiveChatId = useCallback((id: string | null) => {
    activeChatIdRef.current = id;
    setActiveChatIdState(id);
    // Advance cursor so messages already read in the chat don't fire a notification
    inboxSinceRef.current = new Date().toISOString();
    if (id) {
      setUnreadCounts((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, []);

  const push = useCallback((n: Omit<SKNotification, "id" | "createdAt">) => {
    const notif: SKNotification = { ...n, id: crypto.randomUUID(), createdAt: Date.now() };
    setNotifications((prev) => [...prev, notif]);
    if (n.senderId) {
      setUnreadCounts((prev) => ({ ...prev, [n.senderId!]: (prev[n.senderId!] ?? 0) + 1 }));
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Advance cursor when tab becomes visible (avoid notification storm after background)
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") {
        inboxSinceRef.current = new Date().toISOString();
      }
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) inboxSinceRef.current = new Date().toISOString();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Inbox polling every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const myId = localStorage.getItem("sk_my_id");
        if (!myId) return;

        const since = inboxSinceRef.current;
        inboxSinceRef.current = new Date().toISOString();

        const res = await fetch(
          `/api/db/messages?inbox=${encodeURIComponent(myId)}&since=${encodeURIComponent(since)}`
        );
        if (!res.ok) return;
        const { messages } = await res.json();
        if (!messages?.length) return;

        const senderId = messages[0].from_id as string;
        // Skip: user is actively chatting with this sender
        if (activeChatIdRef.current === senderId) return;

        const content = messages[0].content as string;
        let type: NotificationType = "new_message";
        if (content === "§MEETING_REQUEST§")  type = "meeting_request";
        else if (content === "§MEETING_ACCEPTED§") type = "meeting_accepted";
        else if (content === "§MEETING_REFUSED§")  type = "meeting_refused";

        // Resolve sender pin for name/appearance
        let senderName = "Quelqu'un";
        let senderAppearance = "";
        try {
          const pr = await fetch(`/api/db/pins?pin_id=${encodeURIComponent(senderId)}`);
          if (pr.ok) {
            const { pin } = await pr.json();
            if (pin) { senderName = pin.name ?? senderName; senderAppearance = pin.appearance ?? ""; }
          }
        } catch { /* ignore */ }

        push({ type, senderId, senderName, senderAppearance });
      } catch { /* ignore */ }
    }, 10000);

    return () => clearInterval(interval);
  }, [push]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCounts, activeChatId, setActiveChatId, dismiss, push }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
