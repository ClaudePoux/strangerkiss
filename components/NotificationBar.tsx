"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Notif, NotifType } from "@/lib/useNotifications";

const STYLE: Record<NotifType, { bg: string; border: string; text: string; icon: string }> = {
  message:            { bg: "bg-[#7c3aed]/15", border: "border-[#7c3aed]/25", text: "text-[#c4b5fd]", icon: "💬" },
  meeting_request:    { bg: "bg-[#e91e8c]/15", border: "border-[#e91e8c]/25", text: "text-[#f9a8d4]", icon: "💞" },
  meeting_accepted:   { bg: "bg-green-500/15", border: "border-green-500/25", text: "text-green-400", icon: "🎉" },
  low_credits:        { bg: "bg-amber-500/15", border: "border-amber-500/25", text: "text-amber-300", icon: "⚠️" },
  no_credits:         { bg: "bg-red-600/20",   border: "border-red-500/30",   text: "text-red-400",   icon: "🚫" },
  credits_received:   { bg: "bg-green-500/15", border: "border-green-500/25", text: "text-green-400", icon: "💰" },
  new_profiles:       { bg: "bg-sky-500/15",   border: "border-sky-500/25",   text: "text-sky-400",   icon: "👥" },
  profile_expiring:   { bg: "bg-amber-500/15", border: "border-amber-500/25", text: "text-amber-300", icon: "⏰" },
  moderation_warning: { bg: "bg-red-600/20",   border: "border-red-500/30",   text: "text-red-400",   icon: "🚩" },
};

function NotifItem({ notif, onDismiss }: { notif: Notif; onDismiss: () => void }) {
  useEffect(() => {
    if (notif.persistent) return;
    const t = setTimeout(onDismiss, 10_000);
    return () => clearTimeout(t);
  // id change = new notif → restart timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notif.id]);

  const s = STYLE[notif.type];

  const row = (
    <div className={`flex items-center gap-2.5 px-4 py-2 text-xs border-b ${s.bg} ${s.border} ${s.text}`}>
      <span className="flex-shrink-0 text-sm">{s.icon}</span>
      <span className="flex-1 min-w-0 truncate font-medium">{notif.text}</span>
      {notif.href && <span className="flex-shrink-0 opacity-60 text-xs">→</span>}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
        className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity text-base leading-none ml-1"
        aria-label="Fermer"
      >
        ×
      </button>
    </div>
  );

  if (notif.href) {
    return <Link href={notif.href} onClick={onDismiss} className="block">{row}</Link>;
  }
  return row;
}

interface Props {
  notifs: Notif[];
  onDismiss: (id: string) => void;
}

export default function NotificationBar({ notifs, onDismiss }: Props) {
  return (
    <div className="flex-shrink-0 h-10 overflow-hidden border-b border-white/5">
      {notifs.length > 0 && (
        <NotifItem key={notifs[0].id} notif={notifs[0]} onDismiss={() => onDismiss(notifs[0].id)} />
      )}
    </div>
  );
}
