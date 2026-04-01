import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StrangerKiss — Find a hug or a kiss nearby",
  description:
    "Rencontre des voyageurs autour de toi pour échanger un hug ou un French kiss.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#0d0014] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
