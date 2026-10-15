/**
 * The "+" page: every musician can add a piece to the archive.
 *
 * @module
 */
"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";
import { addSong, useArchive } from "@/lib/archive-store";
import type { Song } from "@/lib/song";
import { ModeNotice } from "./mode-notice";
import { SongForm } from "./song-form";

/** What a refused write says. */
const REFUSED =
  "Speichern hat nicht geklappt - vielleicht ist das Archiv gerade geschlossen. Bitte später nochmal.";

/**
 * Renders the page.
 *
 * @returns the form, or the thanks once a piece is added
 * @remarks
 * Adding is open to everybody with a name; changing or deleting pieces
 * stays with the admin (see admin-view.tsx).
 */
export function AddSongView(): ReactElement {
  const archive = useArchive();
  const [added, setAdded] = useState<Song | null>(null);
  // A fresh form after each piece.
  const [round, setRound] = useState(0);
  let content: ReactElement;

  if (added !== null) {
    content = (
      <div className="space-y-4 rounded-2xl bg-emerald-500/10 p-5">
        <p className="text-lg font-semibold">
          Danke! „{added.title}“ ist jetzt im Archiv.
        </p>
        <p className="text-sm text-white/70">
          Die anderen sehen es im Posteingang und unter „Neu“.
          {archive.catalog.videos[added.id] === undefined &&
            " Ohne Video erscheint es in Play nur, wenn dort „alle Stücke“ eingestellt ist."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/#${added.id}`}
            className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black"
          >
            ▶ In Play ansehen
          </Link>
          <button
            type="button"
            onClick={() => {
              setAdded(null);
              setRound(round + 1);
            }}
            className="rounded-xl bg-zinc-800 px-4 py-2"
          >
            + Noch ein Stück
          </button>
        </div>
      </div>
    );
  } else if (archive.mode !== "online") {
    content = (
      <p className="text-white/70">
        {archive.mode === "starting"
          ? "Verbinde ..."
          : "Neue Stücke lassen sich nur mit Verbindung zur Datenbank hinzufügen."}
      </p>
    );
  } else {
    content = (
      <SongForm
        key={round}
        song={null}
        catalog={archive.catalog}
        linked={undefined}
        refused={REFUSED}
        actions={{ save: addSong, onDone: setAdded }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-black tracking-tight">
          Neues Stück
        </h1>
        <ModeNotice mode={archive.mode} />
      </div>
      {added === null && (
        <p className="text-sm text-white/60">
          Ein Stück fehlt im Archiv? Hier kann es jeder eintragen. Ändern oder
          löschen kann es danach nur die Verwaltung - bei Fehlern einfach beim
          Stück „Melden“.
        </p>
      )}
      {content}
    </div>
  );
}
