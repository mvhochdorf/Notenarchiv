/**
 * The tab bar at the bottom: Play, archive, add, inbox and profile.
 *
 * @module
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { useArchive } from "@/lib/archive-store";
import { unreadCount, useLastSeen } from "@/lib/news";

/** The tabs, by path; the one in the middle is the big "+". */
const TABS = [
  { href: "/", label: "Play", icon: "play" },
  { href: "/liste/", label: "Archiv", icon: "archive" },
  { href: "/neu/", label: "Neues Stück", icon: "add" },
  { href: "/posteingang/", label: "Posteingang", icon: "inbox" },
  { href: "/profil/", label: "Profil", icon: "profile" },
] as const;

/** The drawn icons, all but the "+". */
type TabIconName = Exclude<(typeof TABS)[number]["icon"], "add">;

/**
 * The outline of each tab icon, in a 24 by 24 box - drawn as a line, and
 * filled for the current tab, as TikTok does.
 */
const TAB_PATHS: Readonly<Record<TabIconName, string>> = {
  play: "M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z",
  archive: "M4 5h16M4 10h16M4 15h16M4 20h10",
  inbox:
    "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4.5 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  profile:
    "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c.6-3.6 3.8-6 7.5-6s6.9 2.4 7.5 6z",
};

/** Line width of the current tab's icon, and of the others. */
const STROKE_CURRENT = 2.4;
const STROKE_OTHER = 1.8;

/** Icons that are only lines and cannot be filled. */
const LINE_ONLY: ReadonlySet<TabIconName> = new Set(["archive"]);

/** The add tab, drawn as a button rather than a label. */
const ADD_HREF = "/neu/";

/** The inbox tab, which counts unread news. */
const INBOX_HREF = "/posteingang/";

/** Largest count shown on the inbox; more read as "99+". */
const MAX_BADGE = 99;

/**
 * Renders the tab bar.
 *
 * @returns the navigation
 */
export function BottomNav(): ReactElement {
  const pathname = usePathname();
  const archive = useArchive();
  const lastSeen = useLastSeen();
  const unread = unreadCount(archive, lastSeen);

  return (
    <nav className="flex h-14 shrink-0 items-center border-t border-white/10 bg-black">
      {TABS.map((tab) => {
        const current =
          pathname.replace(/\/$/, "") === tab.href.replace(/\/$/, "");
        return tab.href === ADD_HREF ? (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            aria-current={current ? "page" : undefined}
            className="flex flex-1 justify-center"
          >
            <span className="flex h-8 w-12 items-center justify-center rounded-lg bg-white text-2xl leading-none font-bold text-black shadow-[-3px_0_0_#25f4ee,3px_0_0_#fe2c55]">
              +
            </span>
          </Link>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center text-xs font-semibold ${
              current ? "text-white" : "text-white/70 hover:text-white"
            }`}
          >
            <TabIcon name={tab.icon} filled={current} />
            {tab.label}
            {tab.href === INBOX_HREF && unread > 0 && (
              <span className="absolute top-0 left-1/2 ml-2 min-w-5 rounded-full bg-red-500 px-1 text-center text-[11px] leading-5 text-white">
                {unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** One tab's icon, in white like the label. */
function TabIcon({
  name,
  filled,
}: {
  readonly name: TabIconName;
  readonly filled: boolean;
}): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mb-0.5 size-6"
      fill={filled && !LINE_ONLY.has(name) ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? STROKE_CURRENT : STROKE_OTHER}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={TAB_PATHS[name]} />
    </svg>
  );
}
