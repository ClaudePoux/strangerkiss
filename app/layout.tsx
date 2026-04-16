import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StrangerKiss — Find a hug or a kiss nearby",
  description:
    "Meet travellers around you to share a hug or a French kiss.",
  icons: { icon: "/levres.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#0d0014] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
