/**
 * Closes the whole app while the archive is under maintenance.
 *
 * @module
 */
"use client";

import type { ReactElement, ReactNode } from "react";
import { useArchive } from "@/lib/archive-store";
import { ClubLogo } from "./club-logo";

/** What the page says when no message is set. */
const DEFAULT_MESSAGE =
  "Das Notenarchiv wird gerade gewartet. Bitte schau in einer Weile wieder vorbei.";

/**
 * Renders the app, or the maintenance page in its place.
 *
 * @param props - the app
 * @returns the app, or the maintenance page
 * @remarks
 * Switched on in the database (`notenarchiv/maintenance/on`) or by a build
 * made with the workflow's "Wartungsmodus" - see docs/wartungsmodus.md. The
 * app is not rendered at all meanwhile, so no video keeps playing and
 * nothing is written; the database's rules refuse writes as well.
 */
export function MaintenanceGate({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const { maintenance } = useArchive();
  return maintenance.on ? (
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
