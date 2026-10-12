/**
 * Tells the visitor when stars are not shared with everybody.
 *
 * @module
 */
"use client";

import type { ReactElement } from "react";
import type { ArchiveMode } from "@/lib/archive-store";

/** The notice per mode; online and starting need none. */
const NOTICES: Readonly<Record<ArchiveMode, string | null>> = {
  starting: null,
  online: null,
  local: "Lokaler Modus - Bewertungen nur auf diesem Gerät",
  error: "Offline - Bewertungen nur auf diesem Gerät",
};

/**
 * Renders the notice, if the mode needs one.
 *
 * @param props - the archive's connection mode
 * @returns a small pill, or null
 */
export function ModeNotice({
  mode,
}: {
  readonly mode: ArchiveMode;
}): ReactElement | null {
  const notice = NOTICES[mode];
  return notice === null ? null : (
    <span className="w-full rounded-full bg-black/60 px-3 py-1 text-center text-xs text-amber-300 backdrop-blur sm:w-auto">
      {notice}
    </span>
  );
}
