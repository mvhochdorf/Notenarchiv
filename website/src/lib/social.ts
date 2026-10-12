/**
 * Likes, saved pieces and comments: their shapes and how they are read.
 *
 * @module
 */

/** Longest comment, in characters. */
export const MAX_COMMENT_LENGTH = 500;

/** Longest name under a comment: first and last name with a space. */
export const MAX_NAME_LENGTH = 81;

/** One comment on a piece. */
export type Comment = {
  /** Who wrote it - their person id, so they can delete it again. */
  readonly person: string;
  /** The name they chose to show. */
  readonly name: string;
  readonly text: string;
  /** When it was written, in epoch milliseconds. */
  readonly at: number;
};

/** A comment together with its key in the database. */
export type ListedComment = Comment & { readonly id: string };

/** Who marked a piece, by song id and then visitor id. */
export type Marks = Readonly<Record<string, Readonly<Record<string, true>>>>;

/** All comments, by song id and then comment id. */
export type AllComments = Readonly<
  Record<string, Readonly<Record<string, Comment>>>
>;

/**
 * How many visitors marked a piece.
 *
 * @param marks - likes or saved pieces
 * @param songId - which piece
 * @returns the number of visitors
 */
export function markCount(marks: Marks, songId: string): number {
  return Object.keys(marks[songId] ?? {}).length;
}

/**
 * Whether a visitor marked a piece.
 *
 * @param marks - likes or saved pieces
 * @param songId - which piece
 * @param person - the visitor's person id
 * @returns true if they did
 */
export function isMarked(
  marks: Marks,
  songId: string,
  person: string,
): boolean {
  return marks[songId]?.[person] === true;
}

/**
 * The comments of a piece, oldest first.
 *
 * @param all - every comment
 * @param songId - which piece
 * @returns the comments with their ids
 */
export function commentsOf(
  all: AllComments,
  songId: string,
): readonly ListedComment[] {
  return Object.entries(all[songId] ?? {})
    .map(([id, comment]) => ({ ...comment, id }))
    .sort((a, b) => a.at - b.at);
}

/**
 * Keeps only well-formed marks.
 *
 * @param value - what the database or storage holds
 * @returns the marks that are `true`
 */
export function validMarks(value: unknown): Marks {
  const marks: Record<string, Record<string, true>> = {};
  for (const [songId, byVisitor] of entries(value)) {
    for (const [uid, mark] of entries(byVisitor)) {
      if (mark === true) {
        marks[songId] = { ...(marks[songId] ?? {}), [uid]: true };
      }
    }
  }
  return marks;
}

/**
 * Keeps only well-formed comments.
 *
 * @param value - what the database or storage holds
 * @returns the comments that have every field in range
 * @remarks
 * Everybody writes to this node; the security rules check the same, but a
 * bad entry must not break the page either.
 */
export function validComments(value: unknown): AllComments {
  const all: Record<string, Record<string, Comment>> = {};
  for (const [songId, byId] of entries(value)) {
    for (const [id, comment] of entries(byId)) {
      if (isComment(comment)) {
        all[songId] = { ...(all[songId] ?? {}), [id]: comment };
      }
    }
  }
  return all;
}

/**
 * Whether a value is a comment that may be shown.
 *
 * @param value - anything
 * @returns true if it has every field, with text and name in range
 */
export function isComment(value: unknown): value is Comment {
  const comment = value as Comment | null;
  return (
    typeof comment === "object" &&
    comment !== null &&
    typeof comment.person === "string" &&
    typeof comment.name === "string" &&
    comment.name.length <= MAX_NAME_LENGTH &&
    typeof comment.text === "string" &&
    comment.text.trim() !== "" &&
    comment.text.length <= MAX_COMMENT_LENGTH &&
    typeof comment.at === "number"
  );
}

/** Milliseconds per minute, hour and day. */
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Days after which a date is shown instead of a count of days. */
const MAX_DAYS_AGO = 7;

/**
 * How long ago something happened, in German.
 *
 * @param at - when it happened, in epoch milliseconds
 * @param now - the current moment
 * @returns e.g. "gerade eben", "vor 5 Min.", "vor 3 Std.", "vor 2 Tagen" or
 *   a date
 */
export function timeAgo(at: number, now: number): string {
  const ago = now - at;
  let text: string;
  if (ago < MINUTE_MS) {
    text = "gerade eben";
  } else if (ago < HOUR_MS) {
    text = `vor ${Math.floor(ago / MINUTE_MS)} Min.`;
  } else if (ago < DAY_MS) {
    text = `vor ${Math.floor(ago / HOUR_MS)} Std.`;
  } else if (ago < MAX_DAYS_AGO * DAY_MS) {
    const days = Math.floor(ago / DAY_MS);
    text = days === 1 ? "gestern" : `vor ${days} Tagen`;
  } else {
    text = new Date(at).toLocaleDateString("de-DE");
  }
  return text;
}

/** The entries of an object, none for anything else. */
function entries(value: unknown): [string, unknown][] {
  return typeof value === "object" && value !== null
    ? Object.entries(value)
    : [];
}
