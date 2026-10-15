/**
 * Root layout - fonts, metadata and the page shell with the tab bar.
 *
 * @module
 */
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { NameGate } from "@/components/name-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Notenarchiv",
    template: "%s - Notenarchiv",
  },
  description:
    "Das Notenarchiv zum Durchswipen, Anhören und Bewerten - für alle Musikerinnen und Musiker.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): ReactElement {
  return (
    <html lang="de" className={`${geistSans.variable} antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden font-[family-name:var(--font-geist-sans)]">
        <MaintenanceGate>
          <main className="min-h-0 flex-1">{children}</main>
          <BottomNav />
          <NameGate />
        </MaintenanceGate>
      </body>
    </html>
  );
}
