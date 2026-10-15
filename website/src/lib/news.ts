/**
 * The inbox: what the others did in the archive, newest first.
 *
 * @module
 * @remarks
 * Likes and ratings carry no time themselves, so whenever somebody likes,
 * rates or adds a piece the archive also notes when, under
 * `notenarchiv/news/{songId}/{personId}/{kind}` - see archive-store.ts.
 * Taking a like or a rating back removes its note again. Comments bring
 * their own time and are read as they are.
 *
 * Which news the visitor has seen is kept in this browser only.
 */
import { useSyncExternalStore } from "react";
import { readStored, storageKey, writeStored } from "./local-store";
import type { AllVotes } from "./ratings";
import type { AllComments } from "./social";
import type { Song } from "./song";

/** What a note in `notenarchiv/news` stands for. */
export type NewsKind = "like" | "rating" | "added";

/** Every kind of note. */
export const NEWS_KINDS: readonly NewsKind[] = ["like", "rating", "added"];

/** When each person liked, rated or added each piece, in epoch ms. */
export type NewsTimes = Readonly<
  Record<string, Readonly<Record<string, Partial<Record<NewsKind, number>>>>>
>;

/** One entry of the inbox. */
export type NewsItem = {
  /** Unique within the inbox, for React keys. */
  readonly key: string;
  readonly kind: NewsKind | "comment";
  readonly song: Song;
  /** The person's name as they gave it. */
  readonly name: string;
  readonly at: number;
  /** The stars of a rating. */
  readonly stars?: number;
  /** The text of a comment. */
  readonly text?: string;
};

/** What the inbox is built from - the archive's state. */
export type NewsSources = {
  readonly songs: readonly Song[];
  readonly news: NewsTimes;
  readonly comments: AllComments;
  readonly votes: AllVotes;
  readonly people: Readonly<Record<string, string>>;
  readonly me: string;
};

/** Most entries the inbox shows. */
export const MAX_NEWS = 200;

/** Local key of the time the visitor last opened the inbox. */
const SEEN_KEY = storageKey("news", "seen");

/** Schema version of the local entry. */
const SEEN_VERSION = 1;

/** Name shown for a person whose device has not registered a name. */
const UNKNOWN_NAME = "Jemand";

/**
 * The inbox's entries.
 *
 * @param sources - the archive's state
 * @returns what the others did, newest first, at most {@link MAX_NEWS}
 * @remarks
 * The visitor's own doings and pieces no longer shown are left out.
 */
export function newsItems(sources: NewsSources): readonly NewsItem[] {
  const songs = new Map(sources.songs.map((song) => [song.id, song]));
  const items: NewsItem[] = [];
  const nameOf = (person: string) => sources.people[person] ?? UNKNOWN_NAME;

  for (const [songId, byPerson] of Object.entries(sources.news)) {
    const song = songs.get(songId);
    for (const [person, times] of Object.entries(byPerson ?? {})) {
      if (song !== undefined && person !== sources.me) {
        for (const kind of NEWS_KINDS) {
          const at = times?.[kind];
          const stars = sources.votes[songId]?.[person];
          if (
            typeof at === "number" &&
            (kind !== "rating" || stars !== undefined)
          ) {
            items.push({
              key: `${kind}/${songId}/${person}`,
              kind,
              song,
              name: nameOf(person),
              at,
              ...(kind === "rating" ? { stars } : {}),
            });
          }
        }
      }
    }
  }

  for (const [songId, byId] of Object.entries(sources.comments)) {
    const song = songs.get(songId);
    for (const [id, comment] of Object.entries(byId ?? {})) {
      if (song !== undefined && comment.person !== sources.me) {
        items.push({
          key: `comment/${songId}/${id}`,
          kind: "comment",
          song,
          name: comment.name,
          at: comment.at,
          text: comment.text,
        });
      }
    }
  }

  return items.sort((a, b) => b.at - a.at).slice(0, MAX_NEWS);
}

/**
 * Keeps only well-formed notes.
 *
 * @param value - what the database holds at `notenarchiv/news`
 * @returns the notes with a number as time
 */
export function validNews(value: unknown): NewsTimes {
  const news: Record<
    string,
    Record<string, Partial<Record<NewsKind, number>>>
  > = {};
  for (const [songId, byPerson] of Object.entries(asRecord(value))) {
    for (const [person, times] of Object.entries(asRecord(byPerson))) {
      const valid = Object.fromEntries(
        NEWS_KINDS.map((kind) => [kind, asRecord(times)[kind]]).filter(
          ([, at]) => typeof at === "number",
        ),
      );
      if (Object.keys(valid).length > 0) {
        news[songId] = { ...(news[songId] ?? {}), [person]: valid };
      }
    }
  }
  return news;
}

/**
 * When the visitor last opened the inbox, in this browser.
 *
 * @returns epoch ms; until the first visit, the time the app was opened
 *   first, so old news do not all count as new
 */
export function useLastSeen(): number {
  return useSyncExternalStore(
    subscribeSeen,
    () => lastSeen,
    () => 0,
  );
}

/**
 * Notes that the visitor has seen everything up to now.
 *
 * @param at - the time of the newest entry they saw
 */
export function markSeen(at: number): void {
  if (at > lastSeen) {
    lastSeen = at;
    writeStored(SEEN_KEY, SEEN_VERSION, at);
    seenListeners.forEach((listener) => listener());
  }
}

let lastSeen = 0;
let seenRead = false;
const seenListeners = new Set<() => void>();

/** Adds a listener and reads the stored time on first use. */
function subscribeSeen(listener: () => void): () => void {
  seenListeners.add(listener);
  if (!seenRead) {
    seenRead = true;
    const stored = readStored(
      SEEN_KEY,
      SEEN_VERSION,
      (value): value is number => typeof value === "number",
    );
    lastSeen = stored ?? Date.now();
    if (stored === null) {
      writeStored(SEEN_KEY, SEEN_VERSION, lastSeen);
    }
    listener();
  }
  return () => seenListeners.delete(listener);
}

/** A value as a plain object, or an empty one. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
