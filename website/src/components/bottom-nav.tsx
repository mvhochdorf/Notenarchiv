/**
 * The tab bar at the bottom: feed and archive list.
 *
 * @module
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

/** The tabs, by path. */
const TABS = [
  { href: "/", label: "Play", icon: "▶" },
  { href: "/liste/", label: "Archiv", icon: "☰" },
  { href: "/einstellungen/", label: "Einstellungen", icon: "⚙" },
] as const;

/**
 * Renders the tab bar.
 *
 * @returns the navigation
 */
export function BottomNav(): ReactElement {
  const pathname = usePathname();
  return (
    <nav className="flex h-14 shrink-0 border-t border-white/10 bg-black">
      {TABS.map((tab) => {
        const current =
          pathname.replace(/\/$/, "") === tab.href.replace(/\/$/, "");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center text-xs font-semibold ${
              current ? "text-white" : "text-white/45 hover:text-white/80"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
