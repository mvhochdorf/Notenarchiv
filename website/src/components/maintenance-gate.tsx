/**
 * Closes the whole app while the archive is under maintenance.
 *
 * @module
 */
"use client";

import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { useArchive } from "@/lib/archive-store";
import { CLUB } from "@/lib/club";
import { ClubLogo } from "./club-logo";

/** The admin page, which stays open: the archive can be fixed meanwhile. */
const ADMIN_PATH = "/verwaltung";

/** What the page says when no message is set. */
const DEFAULT_MESSAGE = `${CLUB.appName} wird gerade gewartet. Bitte schau in einer Weile wieder vorbei.`;

/**
 * Renders the app, or the maintenance page in its place.
 *
 * @param props - the app
 * @returns the app, or the maintenance page
 * @remarks
 * Switched on in the database (`notenarchiv/maintenance/on`) or by a build
 * made with the workflow's "Wartungsmodus" - see docs/wartungsmodus.md. The
 * app is not rendered at all meanwhile, so no video keeps playing and
 * nothing is written; the database's rules refuse writes as well. Only the
 * admin page stays open, so the catalog can be fixed during the break.
 */
export function MaintenanceGate({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const { maintenance } = useArchive();
  const admin = usePathname().startsWith(ADMIN_PATH);
  return maintenance.on && !admin ? (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-center">
      <ClubLogo className="size-20" />
      <div className="space-y-3">
        <p className="text-5xl" aria-hidden>
          🛠️
        </p>
        <h1 className="text-2xl font-bold">Wartungsarbeiten</h1>
        <p className="max-w-sm text-white/70">
          {maintenance.message || DEFAULT_MESSAGE}
        </p>
      </div>
    </div>
  ) : (
    <>{children}</>
  );
}
