/**
 * The comments of a piece, sliding up from the bottom like on TikTok.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import { addComment, deleteComment, useArchive } from "@/lib/archive-store";
import { displayName } from "@/lib/person";
import { useSettings } from "@/lib/settings";
import { commentsOf, MAX_COMMENT_LENGTH, timeAgo } from "@/lib/social";
import type { Song } from "@/lib/song";

/**
 * Renders the sheet over the feed.
 *
 * @param props - the piece and how to close the sheet
 * @returns the modal sheet
 * @remarks
 * Everybody can read and write, under the name they gave when they first
 * opened the app; a visitor can delete what they wrote themselves.
 */
export function CommentsSheet({
  song,
  onClose,
}: {
  readonly song: Song;
  readonly onClose: () => void;
}): ReactElement {
  const archive = useArchive();
  const settings = useSettings();
  const [now] = useState(() => Date.now());
  const [text, setText] = useState("");
  const name = displayName(settings.firstName, settings.lastName);
  const comments = commentsOf(archive.comments, song.id);
  const canSend = archive.me !== "" && text.trim() !== "";

  const send = () => {
    if (canSend) {
      void addComment(song.id, name, text.trim());
      setText("");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-title"
        className="flex max-h-[75dvh] w-full max-w-xl flex-col rounded-t-3xl bg-zinc-900 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center border-b border-white/10 px-4 py-3">
          <h2 id="comments-title" className="flex-1 text-center font-bold">
            {comments.length}{" "}
            {comments.length === 1 ? "Kommentar" : "Kommentare"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="text-xl text-white/60 hover:text-white"
          >
            ✕
          </button>
        </header>

        <ul className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {comments.length === 0 && (
            <li className="py-8 text-center text-sm text-white/50">
              Noch keine Kommentare zu „{song.title}“. Schreib den ersten!
            </li>
          )}
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400/20 font-bold text-amber-300"
                aria-hidden
              >
                {comment.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/50">
                  <span className="font-semibold text-white/80">
                    {comment.name}
                  </span>{" "}
                  · {timeAgo(comment.at, now)}
                </p>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {comment.text}
                </p>
              </div>
              {comment.person === archive.me && (
                <button
                  type="button"
                  onClick={() => void deleteComment(song.id, comment.id)}
                  className="self-start text-xs text-white/40 hover:text-red-400"
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="space-y-2 border-t border-white/10 px-4 pt-3 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Kommentar hinzufügen ..."
              aria-label="Kommentar"
              className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Senden
            </button>
          </div>
          <p className="text-xs text-white/40">
            Du schreibst als <span className="text-white/70">{name}</span>.
          </p>
        </form>
      </div>
    </div>
  );
}
