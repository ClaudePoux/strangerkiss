"use client";

import { LocaleProvider } from "@/lib/i18n";
import StorageDebug from "@/components/StorageDebug";
import { NotificationProvider } from "@/lib/notificationContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <NotificationProvider>
        <StorageDebug />
        {children}
      </NotificationProvider>
    </LocaleProvider>
  );
}
