"use client";

import { LocaleProvider } from "@/lib/i18n";
import { NotificationProvider } from "@/lib/notificationContext";
import StorageDebug from "@/components/StorageDebug";

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
