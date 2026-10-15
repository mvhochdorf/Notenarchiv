/**
 * The admin's dialog for one piece: change, delete or add.
 *
 * @module
 */
"use client";

import type { ReactElement } from "react";
import { deleteSong, saveSong } from "@/lib/admin";
import { noteNews } from "@/lib/archive-store";
import type { Catalog } from "@/lib/catalog";
import type { Media } from "@/lib/media";
import type { Song } from "@/lib/song";
import { SongForm } from "./song-form";

/** What a refused write says on the admin page. */
const REFUSED =
  "Speichern abgelehnt - sind die Regeln aus database.rules.json veröffentlicht?";

/**
 * Renders the form over the admin page.
 *
 * @param props - the piece (null for a new one), the catalog, the video a
 *   musician linked in the app if any, and how to close
 * @returns the modal dialog
 */
export function SongEditor({
  song,
  catalog,
  linked,
  onClose,
}: {
  readonly song: Song | null;
  readonly catalog: Catalog;
  readonly linked: Media | undefined;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="song-editor-title"
        className="w-full max-w-xl space-y-4 rounded-3xl bg-zinc-900 p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="song-editor-title" className="text-lg font-bold">
          {song === null ? "Neues Stück" : "Stück bearbeiten"}
        </h2>
        <SongForm
          song={song}
          catalog={catalog}
          linked={linked}
          refused={REFUSED}
          actions={{
            save: async (id, entry, replacesLink) => {
              await saveSong(id, entry, replacesLink);
              if (song === null) {
                // Shows in the others' inbox under the admin's own name.
                await noteNews("added", id, true);
              }
            },
            remove: deleteSong,
            onDone: onClose,
            onCancel: onClose,
          }}
        />
      </div>
    </div>
  );
}
