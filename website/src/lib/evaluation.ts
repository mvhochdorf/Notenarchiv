/**
 * The numbers behind the evaluation page, and their export for Excel.
 *
 * @module
 */
import { NO_RATING, type AllVotes, type RatingSummary } from "./ratings";
import { commentsOf, type AllComments, type Marks } from "./social";
import type { Song } from "./song";

/** What the evaluation reads, as the archive store holds it. */
export type EvaluationData = {
  readonly votes: AllVotes;
  readonly summaries: ReadonlyMap<string, RatingSummary>;
  readonly likes: Marks;
  readonly saved: Marks;
  readonly views: Marks;
  readonly comments: AllComments;
  readonly people: Readonly<Record<string, string>>;
};

/** One piece and what everybody did with it. */
export type SongRow = {
  readonly song: Song;
  /** Average stars, 0 without votes. */
  readonly average: number;
  readonly votes: number;
  readonly likes: number;
  readonly saves: number;
  readonly comments: number;
  readonly views: number;
};

/** One person and what they did. */
export type PersonRow = {
  readonly id: string;
  readonly name: string;
  readonly votes: number;
  readonly likes: number;
  readonly saves: number;
  readonly comments: number;
  readonly views: number;
};

/** One comment with the piece it belongs to. */
export type CommentRow = {
  readonly song: Song;
  readonly name: string;
  readonly text: string;
  readonly at: number;
};

/**
 * What everybody did with each piece.
 *
 * @param songs - the pieces
 * @param data - the archive's data
 * @returns one row per piece, in the given order
 */
export function songRows(
  songs: readonly Song[],
  data: EvaluationData,
): readonly SongRow[] {
  return songs.map((song) => {
    const summary = data.summaries.get(song.id) ?? NO_RATING;
    return {
      song,
      average: summary.average,
      votes: summary.count,
      likes: count(data.likes, song.id),
      saves: count(data.saved, song.id),
      comments: Object.keys(data.comments[song.id] ?? {}).length,
      views: count(data.views, song.id),
    };
  });
}

/**
 * What each person did.
 *
 * @param data - the archive's data
 * @returns one row per person who did anything or registered a device,
 *   most active first
 */
export function personRows(data: EvaluationData): readonly PersonRow[] {
  const rows = new Map<string, Mutable<PersonRow>>();
  const row = (id: string) => {
    const existing = rows.get(id);
    const fresh = {
      id,
      name: data.people[id] ?? id,
      votes: 0,
      likes: 0,
      saves: 0,
      comments: 0,
      views: 0,
    };
    if (existing === undefined) {
      rows.set(id, fresh);
    }
    return existing ?? fresh;
  };

  for (const id of Object.keys(data.people)) {
    row(id);
  }
  for (const votes of Object.values(data.votes)) {
    for (const id of Object.keys(votes ?? {})) {
      row(id).votes += 1;
    }
  }
  const marks = [
    [data.likes, "likes"],
    [data.saved, "saves"],
    [data.views, "views"],
  ] as const;
  for (const [byPiece, field] of marks) {
    for (const people of Object.values(byPiece)) {
      for (const id of Object.keys(people)) {
        row(id)[field] += 1;
      }
    }
  }
  for (const byId of Object.values(data.comments)) {
    for (const comment of Object.values(byId)) {
      row(comment.person).comments += 1;
    }
  }

  const activity = (person: PersonRow) =>
    person.votes + person.likes + person.saves + person.comments;
  return [...rows.values()].sort(
    (a, b) => activity(b) - activity(a) || a.name.localeCompare(b.name, "de"),
  );
}

/**
 * Every comment, newest first.
 *
 * @param songs - the pieces, to name them
 * @param data - the archive's data
 * @returns the comments of all pieces
 */
export function commentRows(
  songs: readonly Song[],
  data: EvaluationData,
): readonly CommentRow[] {
  return songs
    .flatMap((song) =>
      commentsOf(data.comments, song.id).map((comment) => ({
        song,
        name: comment.name,
        text: comment.text,
        at: comment.at,
      })),
    )
    .sort((a, b) => b.at - a.at);
}

/**
 * A table as CSV that Excel opens correctly.
 *
 * @param header - the column titles
 * @param rows - the cells, row by row
 * @returns the file content
 * @remarks
 * Semicolons rather than commas and a byte order mark up front: that is what
 * a German Excel expects to read umlauts and columns right on a double click.
 */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header, ...rows].map((row) => row.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** A row whose numbers can be counted up. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** How many people set a mark on a piece. */
function count(marks: Marks, songId: string): number {
  return Object.keys(marks[songId] ?? {}).length;
}
