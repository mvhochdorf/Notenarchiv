/**
 * How the archive list is filtered and sorted, kept between visits - and the
 * list's order handed to Play when a piece is opened from it.
 *
 * @module
 */
import { useSyncExternalStore } from "react";
import { NO_FILTER, type SongFilter, type SortOrder } from "./library";
import { readStored, storageKey, writeStored } from "./local-store";

/** Which pieces the list shows: all, only the saved, only the reported. */
export type ArchiveScope = "all" | "saved" | "reported";

/** Everything the archive list remembers. */
export type ArchiveView = SongFilter & {
  readonly order: SortOrder;
  readonly scope: ArchiveScope;
};

/** What a first visit sees. */
const DEFAULT_VIEW: ArchiveView = {
  ...NO_FILTER,
  order: "title",
  scope: "all",
};

/** Schema version of the stored view - raise it on breaking changes. */
const VIEW_VERSION = 1;

/** Where the view is kept. */
const VIEW_KEY = storageKey("archive", "view");

let current: ArchiveView | null = null;
const listeners = new Set<() => void>();

/**
 * The pieces Play goes through next, in the archive's order.
 *
 * @remarks
 * Kept in memory only: it lasts while the visitor moves between archive and
 * Play, and a reload brings back the usual "for you" feed.
 */
let playQueue: readonly string[] | null = null;

/**
 * Subscribes a component to the archive's filters and order.
 *
 * @returns the current view; the defaults during the prerender
 */
export function useArchiveView(): ArchiveView {
  return useSyncExternalStore(subscribe, loaded, () => DEFAULT_VIEW);
}

/**
 * Changes some of the archive's filters and keeps them for the next visit.
 *
 * @param change - what to change
 */
export function changeArchiveView(change: Partial<ArchiveView>): void {
  current = { ...loaded(), ...change };
  writeStored(VIEW_KEY, VIEW_VERSION, current);
  listeners.forEach((listener) => listener());
}

/**
 * Hands the archive's order to Play.
 *
 * @param songIds - the list as shown, starting with the piece opened
 */
export function queueForPlay(songIds: readonly string[]): void {
  playQueue = songIds;
}

/**
 * The order handed over from the archive, if it starts with a piece.
 *
 * @param firstId - the piece Play was opened with
 * @returns the song ids, or null if Play was not opened from the archive
 */
export function queuedFor(firstId: string): readonly string[] | null {
  return playQueue?.[0] === firstId ? playQueue : null;
}

/** Forgets the handed-over order once Play has taken it. */
export function clearPlayQueue(): void {
  playQueue = null;
}

/** The view, read from storage on first use. */
function loaded(): ArchiveView {
  current ??= {
    ...DEFAULT_VIEW,
    ...readStored(VIEW_KEY, VIEW_VERSION, isView),
  };
  return current;
}

/** Adds a listener. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a stored value has the shape of the view. */
function isView(value: unknown): value is ArchiveView {
  const view = value as ArchiveView | null;
  return (
    typeof view === "object" &&
    view !== null &&
    typeof view.query === "string" &&
    typeof view.order === "string" &&
    typeof view.scope === "string"
  );
}
