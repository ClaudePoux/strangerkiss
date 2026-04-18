import { useState, useCallback } from "react";

export type NotifType =
  | "message"
  | "meeting_request"
  | "meeting_accepted"
  | "low_credits"
  | "no_credits"
  | "credits_received"
  | "new_profiles"
  | "profile_expiring"
  | "moderation_warning";

export interface Notif {
  id: string;
  type: NotifType;
  text: string;
  href?: string;
  /** Si true : ne disparaît pas automatiquement — attend une action. */
  persistent: boolean;
}

// Ces types remplacent toute occurrence précédente (pas de doublon dans la barre)
const SINGLETON_TYPES = new Set<NotifType>([
  "low_credits", "no_credits", "new_profiles", "profile_expiring", "moderation_warning",
]);

export function useNotifications() {
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const push = useCallback((n: Omit<Notif, "id">): string => {
    const id = Math.random().toString(36).slice(2);
    setNotifs(prev => {
      const base = SINGLETON_TYPES.has(n.type) ? prev.filter(p => p.type !== n.type) : prev;
      return [...base, { ...n, id }];
    });
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifs(prev => prev.filter(p => p.id !== id));
  }, []);

  const dismissType = useCallback((type: NotifType) => {
    setNotifs(prev => prev.filter(p => p.type !== type));
  }, []);

  return { notifs, push, dismiss, dismissType };
}
