"use client";

import { LocaleProvider } from "@/lib/i18n";
import StorageDebug from "@/components/StorageDebug";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <StorageDebug />
      {children}
    </LocaleProvider>
  );
}
