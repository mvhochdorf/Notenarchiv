/**
 * The shared, live state of the archive: everybody's stars, likes, saved
 * pieces and comments, and the linked videos.
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
 * - `notenarchiv/users/{uid}` - which person a device belongs to:
 *   `{ firstName, lastName, personId, at }`
 * - `notenarchiv/ratings/{songId}/{personId}` - the stars one person gave
 * - `notenarchiv/media/{songId}` - the YouTube video linked to a piece
 * - `notenarchiv/likes`, `notenarchiv/saved` and `notenarchiv/views`, each
 *   `/{songId}/{personId}` - `true` when that person likes, saved or has
 *   seen the piece
 * - `notenarchiv/comments/{songId}/{commentId}` - a {@link Comment}
 *
 * Without a configured Firebase project the same state lives in this
 * browser's localStorage instead, so the app is usable before the database is
 * set up - only nobody else sees it.
 */
import { useSyncExternalStore } from "react";
import { isFirebaseConfigured } from "./firebase-config";
import { readStored, storageKey, writeStored } from "./local-store";
import { isMedia, type Media } from "./media";
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

/** Local key of the comments written in this browser. */
const LOCAL_COMMENTS_KEY = storageKey("comments", "mine");

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
  /** The visitor's person id, empty until they gave their name. */
  readonly me: string;
  /** Everybody's name, by person id, as their devices registered it. */
  readonly people: Readonly<Record<string, string>>;
};

/** The state before anything is loaded, also used for the prerender. */
const INITIAL: ArchiveState = {
  mode: "starting",
  votes: {},
  media: {},
  summaries: new Map(),
  mine: {},
  ready: false,
  likes: {},
  views: {},
  saved: {},
  comments: {},
  me: "",
  people: {},
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
      await (stars === null ? remove(path) : set(path, stars));
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
    await (media === null
      ? remove(path)
      : set(path, { videoId: media.videoId, start: media.start }));
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
      await (on ? set(path, true) : remove(path));
    } else {
      writeStored(LOCAL_MARK_KEYS[kind], LOCAL_VERSION, state[kind]);
    }
  }
}

/**
 * Adds a comment to a piece.
 *
 * @param songId - which piece
 * @param name - the name to show
 * @param text - the comment
 */
export async function addComment(
  songId: string,
  name: string,
  text: string,
): Promise<void> {
  // Nothing is kept before the visitor gave their name: it would belong
  // to nobody.
  if (person !== "") {
    const comment: Comment = { person, name, text, at: Date.now() };
    if (state.mode === "online") {
      const { database } = await import("./firebase-app");
      const { push, ref } = await import("firebase/database");
      // The live listener shows it as soon as the database has it.
      await push(ref(database(), `${ROOT}/comments/${songId}`), comment);
    } else {
      const id = `${comment.at}-${Math.random().toString(ID_RADIX).slice(2)}`;
      setComment(songId, id, comment);
    }
  }
}

/**
 * Deletes one of the visitor's own comments.
 *
 * @param songId - which piece
 * @param commentId - which comment
 */
export async function deleteComment(
  songId: string,
  commentId: string,
): Promise<void> {
  if (state.mode === "online") {
    const { database } = await import("./firebase-app");
    const { ref, remove } = await import("firebase/database");
    await remove(ref(database(), `${ROOT}/comments/${songId}/${commentId}`));
  } else {
    setComment(songId, commentId, null);
  }
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

/** Changes one comment in local mode and keeps the result. */
function setComment(
  songId: string,
  commentId: string,
  comment: Comment | null,
): void {
  const byId: Record<string, Comment> = { ...(state.comments[songId] ?? {}) };
  if (comment === null) {
    delete byId[commentId];
  } else {
    byId[commentId] = comment;
  }
  update({ comments: { ...state.comments, [songId]: byId } });
  writeStored(LOCAL_COMMENTS_KEY, LOCAL_VERSION, state.comments);
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
  if (isFirebaseConfigured()) {
    try {
      const { database, signIn } = await import("./firebase-app");
      const { onValue, ref } = await import("firebase/database");
      uid = await signIn();
      if (person !== "") {
        await registerDevice();
      }
      const db = database();
      // The store is ready once every node has answered once.
      const waiting = new Set([
        "ratings",
        "media",
        "comments",
        "users",
        ...MARK_KINDS,
      ]);
      const listen = (node: string, apply: (value: unknown) => void) => {
        onValue(ref(db, `${ROOT}/${node}`), (snapshot) => {
          apply(snapshot.val());
          waiting.delete(node);
          update({ mode: "online", ready: waiting.size === 0 });
        });
      };
      listen("ratings", (value) => setVotes((value ?? {}) as AllVotes));
      listen("media", (value) => update({ media: validMedia(value) }));
      listen("comments", (value) => update({ comments: validComments(value) }));
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
    comments: validComments(
      readStored(LOCAL_COMMENTS_KEY, LOCAL_VERSION, isRecord),
    ),
  });
  setVotes(votes);
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
