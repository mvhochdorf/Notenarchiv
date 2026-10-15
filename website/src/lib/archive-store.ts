/**
 * The shared, live state of the archive: the catalog of pieces, everybody's
 * stars, likes, saved pieces and comments, and the linked videos.
 *
 * @module
 * @remarks
 * One store for the whole app, read through {@link useArchive}. It connects
 * the first time a page asks for it and stays connected while the visitor
 * switches between feed and list.
 *
 * Everything a visitor does is kept under their person id - made from
 * their name, the same on every device (see person.ts). Stored in the
 * Realtime Database as
 *
 * - `notenarchiv/catalog/{songId}` - the pieces and their videos, kept by
 *   the admin (see catalog.ts)
 * - `notenarchiv/users/{uid}` - which person a device belongs to:
 *   `{ firstName, lastName, personId, at }`
 * - `notenarchiv/ratings/{songId}/{personId}` - the stars one person gave
 * - `notenarchiv/media/{songId}` - the YouTube video linked to a piece
 * - `notenarchiv/likes`, `notenarchiv/saved` and `notenarchiv/views`, each
 *   `/{songId}/{personId}` - `true` when that person likes, saved or has
 *   seen the piece
 * - `notenarchiv/comments/{songId}/{commentId}` - a {@link Comment}
 * - `notenarchiv/news/{songId}/{personId}/{like|rating|added}` - when that
 *   person liked, rated or added the piece, for the inbox (see news.ts)
 * - `notenarchiv/reports/{songId}/{reportId}` - a note for the admin about
 *   something wrong with the piece (wrong video, wrong title, ...), stored
 *   like a comment
 *
 * Without a configured Firebase project the same state lives in this
 * browser's localStorage instead - only nobody else sees it. The pieces
 * themselves come from the database only, so the archive is empty then.
 */
import { useSyncExternalStore } from "react";
import {
  catalogOf,
  EMPTY_CATALOG,
  type Catalog,
  type CatalogEntry,
} from "./catalog";
import { isFirebaseConfigured } from "./firebase-config";
import { readStored, storageKey, writeStored } from "./local-store";
import { visibleSongs } from "./library";
import { isMedia, type Media } from "./media";
import { validNews, type NewsKind, type NewsTimes } from "./news";
import { displayName, personId } from "./person";
import {
  isStars,
  summarize,
  type AllVotes,
  type RatingSummary,
} from "./ratings";
import {
  validComments,
  validMarks,
  type AllComments,
  type Comment,
  type Marks,
} from "./social";
import { changeSettings, currentSettings } from "./settings";
import type { Song } from "./song";

/** Where everything of this app lives in the database. */
const ROOT = "notenarchiv";

/** Schema version of the local entries. */
const LOCAL_VERSION = 1;

/** Local key of the visitor's own stars. */
const LOCAL_RATINGS_KEY = storageKey("ratings", "mine");

/** Local key of the linked videos. */
const LOCAL_MEDIA_KEY = storageKey("media", "linked");

/** Local key of the visitor's likes and saved pieces, by kind. */
const LOCAL_MARK_KEYS: Readonly<Record<MarkKind, string>> = {
  likes: storageKey("likes", "mine"),
  saved: storageKey("saved", "mine"),
  views: storageKey("views", "mine"),
};

/** Local key of the comments and reports written in this browser. */
const LOCAL_NOTE_KEYS: Readonly<Record<NoteKind, string>> = {
  comments: storageKey("comments", "mine"),
  reports: storageKey("reports", "mine"),
};

/** The kinds of text notes on a piece: comments for all, reports for the admin. */
export type NoteKind = "comments" | "reports";

/** Every kind of note. */
const NOTE_KINDS: readonly NoteKind[] = ["comments", "reports"];

/** The maintenance switch and its message. */
export type Maintenance = {
  readonly on: boolean;
  readonly message: string;
};

/**
 * Whether this build is the maintenance page only.
 *
 * @remarks
 * Set by the "Wartungsmodus" option of the GitHub workflow. Such a build
 * shows the maintenance page and never connects to the database. The other
 * way in is the switch `notenarchiv/maintenance/on` in the database itself,
 * which closes every open page within seconds - see docs/wartungsmodus.md.
 */
const BUILD_MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE === "true";

/** Base of the random part of local comment ids (digits and letters). */
const ID_RADIX = 36;

/** The kinds of marks set on a piece: liked, saved, seen. */
export type MarkKind = "likes" | "saved" | "views";

/** Every kind of mark. */
const MARK_KINDS: readonly MarkKind[] = ["likes", "saved", "views"];

/** How the archive is connected. */
export type ArchiveMode = "starting" | "local" | "online" | "error";

/** Everything the pages need to know. */
export type ArchiveState = {
  readonly mode: ArchiveMode;
  /** Every piece and its video, hidden categories included. */
  readonly catalog: Catalog;
  /** The pieces the app shows, by archive number. */
  readonly songs: readonly Song[];
  readonly votes: AllVotes;
  readonly media: Readonly<Record<string, Media>>;
  readonly summaries: ReadonlyMap<string, RatingSummary>;
  /** The visitor's own stars per song id. */
  readonly mine: Readonly<Record<string, number>>;
  /** Whether every part has been loaded once; until then rankings guess. */
  readonly ready: boolean;
  readonly likes: Marks;
  readonly views: Marks;
  readonly saved: Marks;
  readonly comments: AllComments;
  /** Notes about something wrong with a piece, for the admin. */
  readonly reports: AllComments;
  /** When people liked, rated or added pieces, for the inbox. */
  readonly news: NewsTimes;
  /** The visitor's person id, empty until they gave their name. */
  readonly me: string;
  /** Everybody's name, by person id, as their devices registered it. */
  readonly people: Readonly<Record<string, string>>;
  /** Whether the archive is closed for maintenance, and what it says. */
  readonly maintenance: Maintenance;
};

/** The state before anything is loaded, also used for the prerender. */
const INITIAL: ArchiveState = {
  mode: "starting",
  catalog: EMPTY_CATALOG,
  songs: [],
  votes: {},
  media: {},
  summaries: new Map(),
  mine: {},
  ready: false,
  likes: {},
  views: {},
  saved: {},
  comments: {},
  reports: {},
  news: {},
  me: "",
  people: {},
  maintenance: { on: BUILD_MAINTENANCE, message: "" },
};

let state: ArchiveState = INITIAL;
/** This device's anonymous Firebase id, empty in local mode. */
let uid = "";
/** The person this device belongs to, empty until named. */
let person = "";
let started = false;
const listeners = new Set<() => void>();

/**
 * Subscribes a component to the archive.
 *
 * @returns the current state; re-renders whenever votes or videos change
 */
export function useArchive(): ArchiveState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

/**
 * Tells the archive who is using this device.
 *
 * @param firstName - as entered
 * @param lastName - as entered
 * @remarks
 * Keeps the name in the settings and, when online, registers the device
 * under that person - the security rules only accept data for the person
 * the device is registered to, so this has to be done before anything is
 * written.
 */
export async function identify(
  firstName: string,
  lastName: string,
): Promise<void> {
  changeSettings({ firstName: firstName.trim(), lastName: lastName.trim() });
  person = personId(firstName, lastName);
  update({
    me: person,
    people: { ...state.people, [person]: displayName(firstName, lastName) },
  });
  setVotes(state.votes);
  if (uid !== "") {
    await registerDevice();
  }
}

/**
 * Gives, changes or takes back the visitor's stars for a piece.
 *
 * @param songId - which piece
 * @param stars - the new rating, or null to remove it
 */
export async function rate(
  songId: string,
  stars: number | null,
): Promise<void> {
  // Nothing is kept before the visitor gave their name: it would belong
  // to nobody.
  if (person !== "") {
    const votes = { ...(state.votes[songId] ?? {}) };
    if (stars === null) {
      delete votes[person];
    } else {
      votes[person] = stars;
    }
    setVotes({ ...state.votes, [songId]: votes });

    if (state.mode === "online") {
      const { database } = await import("./firebase-app");
      const { ref, remove, set } = await import("firebase/database");
      const path = ref(database(), `${ROOT}/ratings/${songId}/${person}`);
      await written(stars === null ? remove(path) : set(path, stars));
      await noteNews("rating", songId, stars !== null);
    } else {
      writeStored(LOCAL_RATINGS_KEY, LOCAL_VERSION, state.mine);
    }
  }
}

/**
 * Links a YouTube video to a piece, or removes the link.
 *
 * @param songId - which piece
 * @param media - the video and snippet start, or null to unlink
 */
export async function linkMedia(
  songId: string,
  media: Media | null,
): Promise<void> {
  const all = { ...state.media };
  if (media === null) {
    delete all[songId];
  } else {
    all[songId] = media;
  }
  update({ media: all });

  if (state.mode === "online") {
    const { database } = await import("./firebase-app");
    const { ref, remove, set } = await import("firebase/database");
    const path = ref(database(), `${ROOT}/media/${songId}`);
    await written(
      media === null
        ? remove(path)
        : set(path, { videoId: media.videoId, start: media.start }),
    );
  } else {
    writeStored(LOCAL_MEDIA_KEY, LOCAL_VERSION, all);
  }
}

/**
 * Sets or removes the visitor's like or bookmark on a piece.
 *
 * @param kind - likes or saved pieces
 * @param songId - which piece
 * @param on - whether the mark is set
 */
export async function mark(
  kind: MarkKind,
  songId: string,
  on: boolean,
): Promise<void> {
  // Nothing is kept before the visitor gave their name: it would belong
  // to nobody.
  if (person !== "") {
    const byVisitor: Record<string, true> = { ...(state[kind][songId] ?? {}) };
    if (on) {
      byVisitor[person] = true;
    } else {
      delete byVisitor[person];
    }
    update({ [kind]: { ...state[kind], [songId]: byVisitor } });

    if (state.mode === "online") {
      const { database } = await import("./firebase-app");
      const { ref, remove, set } = await import("firebase/database");
      const path = ref(database(), `${ROOT}/${kind}/${songId}/${person}`);
      await written(on ? set(path, true) : remove(path));
      if (kind === "likes") {
        await noteNews("like", songId, on);
      }
    } else {
      writeStored(LOCAL_MARK_KEYS[kind], LOCAL_VERSION, state[kind]);
    }
  }
}

/**
 * Adds a new piece to the catalog - open to every musician.
 *
 * @param songId - the new piece's id, not yet in use
 * @param entry - its fields
 * @throws when the archive is offline, the visitor has no name yet or the
 *   database refuses (the id is taken, the archive is closed)
 * @remarks
 * Changing or deleting pieces is left to the admin; the database's rules
 * let a musician only create a piece that does not exist yet, marked with
 * their person id.
 */
export async function addSong(
  songId: string,
  entry: CatalogEntry,
): Promise<void> {
  if (state.mode !== "online" || person === "") {
    throw new Error("Nur online und mit Namen möglich.");
  }
  const { database } = await import("./firebase-app");
  const { ref, set } = await import("firebase/database");
  await set(ref(database(), `${ROOT}/catalog/${songId}`), {
    ...entry,
    addedBy: person,
  });
  await noteNews("added", songId, true);
}

/**
 * Notes for the inbox when the visitor did something to a piece.
 *
 * @param kind - liked, rated or added
 * @param songId - which piece
 * @param on - whether it is done or taken back
 */
export async function noteNews(
  kind: NewsKind,
  songId: string,
  on: boolean,
): Promise<void> {
  if (state.mode === "online" && person !== "") {
    const { database } = await import("./firebase-app");
    const { ref, remove, serverTimestamp, set } =
      await import("firebase/database");
    const path = ref(database(), `${ROOT}/news/${songId}/${person}/${kind}`);
    await written(on ? set(path, serverTimestamp()) : remove(path));
  }
}

/**
 * Adds a comment or a report to a piece.
 *
 * @param songId - which piece
 * @param name - the name to show
 * @param text - the comment
 * @param kind - a comment for everybody, or a report for the admin
 */
export async function addComment(
  songId: string,
  name: string,
  text: string,
  kind: NoteKind = "comments",
): Promise<void> {
  // Nothing is kept before the visitor gave their name: it would belong
  // to nobody.
  if (person !== "") {
    const comment: Comment = { person, name, text, at: Date.now() };
    if (state.mode === "online") {
      const { database } = await import("./firebase-app");
      const { push, ref } = await import("firebase/database");
      // The live listener shows it as soon as the database has it.
      await written(
        push(ref(database(), `${ROOT}/${kind}/${songId}`), comment),
      );
    } else {
      const id = `${comment.at}-${Math.random().toString(ID_RADIX).slice(2)}`;
      setComment(kind, songId, id, comment);
    }
  }
}

/**
 * Deletes one of the visitor's own comments or reports.
 *
 * @param songId - which piece
 * @param commentId - which comment
 * @param kind - whether it is a comment or a report
 */
export async function deleteComment(
  songId: string,
  commentId: string,
  kind: NoteKind = "comments",
): Promise<void> {
  if (state.mode === "online") {
    const { database } = await import("./firebase-app");
    const { ref, remove } = await import("firebase/database");
    await written(
      remove(ref(database(), `${ROOT}/${kind}/${songId}/${commentId}`)),
    );
  } else {
    setComment(kind, songId, commentId, null);
  }
}

/**
 * Waits for a write, and lets a refused one pass with a warning.
 *
 * @remarks
 * The database refuses writes its rules do not allow - mostly because the
 * rules published in the Firebase console are older than the app. The live
 * listeners then put back what the database holds, so the page shows the
 * truth again; an uncaught error would only clutter the console.
 */
async function written(write: PromiseLike<unknown>): Promise<void> {
  try {
    await write;
  } catch (error) {
    console.warn(
      "Notenarchiv: Speichern abgelehnt - Regeln aus database.rules.json neu veröffentlichen?",
      error,
    );
  }
}

/** The maintenance switch as read from the database. */
function maintenanceOf(value: unknown): Maintenance {
  const entry = (value ?? {}) as Record<string, unknown>;
  return {
    on: entry.on === true,
    message: typeof entry.message === "string" ? entry.message : "",
  };
}

/** Notes in the database which person this device belongs to. */
async function registerDevice(): Promise<void> {
  const { firstName, lastName } = currentSettings();
  const { database } = await import("./firebase-app");
  const { ref, set } = await import("firebase/database");
  await set(ref(database(), `${ROOT}/users/${uid}`), {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    personId: person,
    at: Date.now(),
  });
}

/** Everybody's name by person id, from the registered devices. */
function peopleOf(value: unknown): Record<string, string> {
  const people: Record<string, string> = {};
  for (const device of Object.values(
    (value ?? {}) as Record<string, unknown>,
  )) {
    const entry = device as Record<string, unknown> | null;
    if (
      typeof entry?.personId === "string" &&
      typeof entry.firstName === "string" &&
      typeof entry.lastName === "string"
    ) {
      people[entry.personId] = displayName(entry.firstName, entry.lastName);
    }
  }
  return people;
}

/** The visitor's own name, so it shows before the database has it. */
function ownName(): Record<string, string> {
  const { firstName, lastName } = currentSettings();
  return person === "" ? {} : { [person]: displayName(firstName, lastName) };
}

/** Changes one comment or report in local mode and keeps the result. */
function setComment(
  kind: NoteKind,
  songId: string,
  commentId: string,
  comment: Comment | null,
): void {
  const byId: Record<string, Comment> = { ...(state[kind][songId] ?? {}) };
  if (comment === null) {
    delete byId[commentId];
  } else {
    byId[commentId] = comment;
  }
  update({ [kind]: { ...state[kind], [songId]: byId } });
  writeStored(LOCAL_NOTE_KEYS[kind], LOCAL_VERSION, state[kind]);
}

/** Adds a listener and starts the store on first use. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    void start();
  }
  return () => listeners.delete(listener);
}

/** Connects to Firebase, or falls back to local storage. */
async function start(): Promise<void> {
  const { firstName, lastName } = currentSettings();
  person = personId(firstName, lastName);
  update({ me: person, people: ownName() });
  if (BUILD_MAINTENANCE) {
    // The maintenance build stays away from the database altogether.
    update({ ready: true });
  } else if (isFirebaseConfigured()) {
    try {
      const { database, signIn } = await import("./firebase-app");
      const { onValue, ref } = await import("firebase/database");
      const db = database();
      // Readable by everybody, signed in or not: a closed archive says so
      // even when signing in fails.
      onValue(ref(db, `${ROOT}/maintenance`), (snapshot) => {
        update({ maintenance: maintenanceOf(snapshot.val()) });
      });
      uid = await signIn();
      if (person !== "") {
        // Refused while the archive is closed - nothing to worry about then.
        await written(registerDevice());
      }
      // The store is ready once every node has answered once.
      const waiting = new Set([
        "catalog",
        "ratings",
        "media",
        "users",
        "news",
        ...NOTE_KINDS,
        ...MARK_KINDS,
      ]);
      const answered = (node: string) => {
        waiting.delete(node);
        update({ mode: "online", ready: waiting.size === 0 });
      };
      const listen = (node: string, apply: (value: unknown) => void) => {
        onValue(
          ref(db, `${ROOT}/${node}`),
          (snapshot) => {
            apply(snapshot.val());
            answered(node);
          },
          (error) => {
            // Mostly rules that do not know this part yet (published before
            // it was added). The rest of the archive still works.
            console.warn(
              `Notenarchiv: "${node}" nicht lesbar - Regeln aus database.rules.json neu veröffentlichen?`,
              error,
            );
            answered(node);
          },
        );
      };
      listen("catalog", (value) => setCatalog(catalogOf(value)));
      listen("ratings", (value) => setVotes((value ?? {}) as AllVotes));
      listen("media", (value) => update({ media: validMedia(value) }));
      for (const kind of NOTE_KINDS) {
        listen(kind, (value) => update({ [kind]: validComments(value) }));
      }
      listen("news", (value) => update({ news: validNews(value) }));
      listen("users", (value) =>
        update({ people: { ...peopleOf(value), ...ownName() } }),
      );
      for (const kind of MARK_KINDS) {
        listen(kind, (value) => update({ [kind]: validMarks(value) }));
      }
    } catch {
      // Offline or blocked: show what this browser knows.
      startLocal("error");
    }
  } else {
    startLocal("local");
  }
}

/** Loads the state kept in this browser. */
function startLocal(mode: ArchiveMode): void {
  const mine = readStored(LOCAL_RATINGS_KEY, LOCAL_VERSION, isRecord) ?? {};
  const votes: Record<string, Record<string, number>> = {};
  for (const [songId, stars] of Object.entries(mine)) {
    if (isStars(stars)) {
      votes[songId] = { [person]: stars };
    }
  }
  const media = validMedia(
    readStored(LOCAL_MEDIA_KEY, LOCAL_VERSION, isRecord),
  );
  update({
    mode,
    media,
    ready: true,
    ...Object.fromEntries(
      MARK_KINDS.map((kind) => [
        kind,
        validMarks(readStored(LOCAL_MARK_KEYS[kind], LOCAL_VERSION, isRecord)),
      ]),
    ),
    ...Object.fromEntries(
      NOTE_KINDS.map((kind) => [
        kind,
        validComments(
          readStored(LOCAL_NOTE_KEYS[kind], LOCAL_VERSION, isRecord),
        ),
      ]),
    ),
  });
  setVotes(votes);
}

/** Replaces the catalog; an empty database means no pieces yet. */
function setCatalog(stored: Catalog | null): void {
  const catalog = stored ?? EMPTY_CATALOG;
  update({ catalog, songs: visibleSongs(catalog.songs) });
}

/** Replaces the votes and everything derived from them. */
function setVotes(votes: AllVotes, mode?: ArchiveMode): void {
  const mine: Record<string, number> = {};
  for (const [songId, byVoter] of Object.entries(votes)) {
    const stars = byVoter?.[person];
    if (isStars(stars)) {
      mine[songId] = stars;
    }
  }
  update({
    votes,
    mine,
    summaries: summarize(votes),
    ...(mode === undefined ? {} : { mode }),
  });
}

/** Swaps in a new state and tells every subscriber. */
function update(change: Partial<ArchiveState>): void {
  state = { ...state, ...change };
  listeners.forEach((listener) => listener());
}

/** Keeps only the well-formed video links. */
function validMedia(value: unknown): Record<string, Media> {
  const media: Record<string, Media> = {};
  for (const [songId, entry] of Object.entries(
    (value ?? {}) as Record<string, unknown>,
  )) {
    if (isMedia(entry)) {
      media[songId] = { videoId: entry.videoId, start: entry.start };
    }
  }
  return media;
}

/** Whether a stored value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
