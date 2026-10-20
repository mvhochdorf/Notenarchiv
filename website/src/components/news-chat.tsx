/**
 * The archive's news chat at the top of the inbox: everybody reads it, the
 * admins write it.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import {
  deleteAnnouncement,
  editAnnouncement,
  postAnnouncement,
  useAdmin,
} from "@/lib/admin";
import { CLUB } from "@/lib/club";
import { MAX_ANNOUNCEMENT, type Announcement } from "@/lib/news";
import { timeAgo } from "@/lib/social";
import { ClubLogo } from "./club-logo";

/** Longest preview of the last message on the card. */
const MAX_PREVIEW = 90;

/** What a refused write says. */
const REFUSED =
  "Abgelehnt - sind die Regeln aus database.rules.json veröffentlicht?";

/**
 * The pinned card that opens the chat.
 *
 * @param props - the messages, whether there is something new, the time to
 *   count from, and what to do when tapped
 * @returns the card
 */
export function NewsCard({
  messages,
  unread,
  now,
  onOpen,
}: {
  readonly messages: readonly Announcement[];
  readonly unread: boolean;
  readonly now: number;
  readonly onOpen: () => void;
}): ReactElement {
  const last = messages.at(-1);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 hover:bg-white/10 ${
        unread
          ? "bg-amber-400/10 ring-amber-400/60"
          : "bg-white/5 ring-white/10"
      }`}
    >
      <span className="relative shrink-0">
        <ClubLogo className="size-11" />
        {unread && (
          <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-red-500 ring-2 ring-zinc-950" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <strong className="truncate">📣 News vom {CLUB.appName}</strong>
          {last !== undefined && (
            <span className="ml-auto shrink-0 text-xs text-white/40">
              {timeAgo(last.at, now)}
            </span>
          )}
        </span>
        <span className="block truncate text-sm text-white/60">
          {last === undefined
            ? "Noch keine Nachrichten."
            : last.text.slice(0, MAX_PREVIEW)}
        </span>
      </span>
      <span className="text-white/40" aria-hidden>
        ›
      </span>
    </button>
  );
}

/**
 * The chat itself: messages oldest first, and for admins a field to write
 * and a way to delete.
 *
 * @param props - the messages, the time to count from, where new ones begin,
 *   and how to go back
 * @returns the chat
 */
export function NewsChat({
  messages,
  now,
  seenBefore,
  onBack,
}: {
  readonly messages: readonly Announcement[];
  readonly now: number;
  readonly seenBefore: number | null;
  readonly onBack: () => void;
}): ReactElement {
  const admin = useAdmin();
  const isAdmin = admin.status === "signedIn";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The message being edited, and its new text.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const saveEdit = async (message: Announcement) => {
    setBusy(true);
    setError("");
    try {
      await editAnnouncement(message.id, draft.trim());
      setEditing(null);
    } catch {
      setError(REFUSED);
    }
    setBusy(false);
  };

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await postAnnouncement(text.trim());
      setText("");
    } catch {
      setError(REFUSED);
    }
    setBusy(false);
  };

  const remove = async (message: Announcement) => {
    if (window.confirm("Diese Nachricht löschen?")) {
      try {
        await deleteAnnouncement(message.id);
      } catch {
        setError(REFUSED);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Zurück"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-full bg-white/10 text-xl"
        >
          ‹
        </button>
        <ClubLogo className="size-9" />
        <h1 className="truncate text-xl font-black tracking-tight">
          📣 News vom {CLUB.appName}
        </h1>
      </div>

      {messages.length === 0 && (
        <p className="text-white/60">
          Noch keine Nachrichten. Hier schreibt die Verwaltung, was es Neues
          gibt.
        </p>
      )}

      <ul className="space-y-3">
        {messages.map((message) => (
          <li key={message.id} className="flex items-end gap-2">
            <ClubLogo className="size-7 shrink-0" />
            <div
              className={`max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 ${
                seenBefore !== null && message.at > seenBefore
                  ? "bg-amber-400/15"
                  : "bg-white/10"
              }`}
            >
              {editing === message.id ? (
                <div className="space-y-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={MAX_ANNOUNCEMENT}
                    rows={4}
                    aria-label="Nachricht bearbeiten"
                    className="w-72 max-w-full resize-y rounded-xl bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus
                  />
                  <div className="flex gap-2 text-sm">
                    <button
                      type="button"
                      disabled={busy || draft.trim() === ""}
                      onClick={() => void saveEdit(message)}
                      className="rounded-lg bg-amber-400 px-3 py-1 font-semibold text-black disabled:opacity-40"
                    >
                      Speichern
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-lg bg-zinc-800 px-3 py-1"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-line">{message.text}</p>
              )}
              <p className="mt-1 flex items-center gap-3 text-xs text-white/40">
                {timeAgo(message.at, now)}
                {message.edited !== undefined && " · bearbeitet"}
                {isAdmin && editing !== message.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(message.id);
                        setDraft(message.text);
                      }}
                      className="text-amber-300 hover:underline"
                    >
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(message)}
                      className="text-red-400 hover:underline"
                    >
                      Löschen
                    </button>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {error !== "" && <p className="text-sm text-red-400">{error}</p>}

      {isAdmin ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_ANNOUNCEMENT}
            rows={2}
            placeholder="Neue Nachricht an alle ..."
            aria-label="Nachricht"
            className="min-w-0 flex-1 resize-none rounded-2xl bg-white/5 px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={busy || text.trim() === ""}
            className="rounded-2xl bg-amber-400 px-4 py-2.5 font-semibold text-black disabled:opacity-40"
          >
            Senden
          </button>
        </form>
      ) : (
        <p className="text-xs text-white/40">
          Nur die Verwaltung schreibt hier.
        </p>
      )}
    </div>
  );
}
