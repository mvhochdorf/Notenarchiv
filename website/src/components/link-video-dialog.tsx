/**
 * Lets a musician link a YouTube video to a piece.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import { linkMedia } from "@/lib/archive-store";
import { parseYouTube, searchUrl, type Media } from "@/lib/media";
import type { Song } from "@/lib/song";

/**
 * Renders the dialog over the feed.
 *
 * @param props - the piece, its current video if any, whether that video was
 *   linked in the app, whether the catalog has one, and how to close
 * @returns the modal dialog
 */
export function LinkVideoDialog({
  song,
  current,
  ownLink,
  inCatalog,
  onClose,
}: {
  readonly song: Song;
  readonly current: Media | undefined;
  readonly ownLink: boolean;
  readonly inCatalog: boolean;
  readonly onClose: () => void;
}): ReactElement {
  const [link, setLink] = useState(
    current === undefined ? "" : `https://youtu.be/${current.videoId}`,
  );
  const [start, setStart] = useState(String(current?.start ?? 0));
  const parsed = parseYouTube(link);
  const startSeconds = Math.max(0, Math.floor(Number(start) || 0));

  const changeLink = (value: string) => {
    setLink(value);
    const media = parseYouTube(value);
    if (media !== null && media.start > 0) {
      setStart(String(media.start));
    }
  };

  const save = () => {
    if (parsed !== null) {
      void linkMedia(song.id, { videoId: parsed.videoId, start: startSeconds });
      onClose();
    }
  };

  const unlink = () => {
    void linkMedia(song.id, null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-video-title"
        className="w-full max-w-md space-y-4 rounded-3xl bg-zinc-900 p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <h2 id="link-video-title" className="text-lg font-bold">
            Video verknüpfen
          </h2>
          <p className="text-sm text-white/60">{song.title}</p>
        </div>

        <a
          href={searchUrl(
            [song.title, song.composer, "Blasmusik"].filter(Boolean).join(" "),
          )}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl bg-red-600 px-4 py-3 text-center font-semibold hover:bg-red-500"
        >
          Auf YouTube suchen ↗
        </a>

        <label className="block space-y-1">
          <span className="text-sm text-white/70">YouTube-Link einfügen</span>
          <input
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => changeLink(event.target.value)}
            placeholder="https://youtu.be/..."
            className="w-full rounded-xl bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
            autoFocus
          />
          {link !== "" && parsed === null && (
            <span className="text-sm text-red-400">
              Das ist kein YouTube-Video-Link.
            </span>
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-white/70">
            Ausschnitt beginnt bei Sekunde
          </span>
          <input
            type="number"
            min={0}
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="w-32 rounded-xl bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={parsed === null}
            className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-40"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-800 px-4 py-2"
          >
            Abbrechen
          </button>
          {ownLink && (
            <button
              type="button"
              onClick={unlink}
              className="ml-auto rounded-xl px-4 py-2 text-red-400 hover:bg-red-950"
            >
              {inCatalog ? "Zurück zum Standard" : "Entfernen"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
