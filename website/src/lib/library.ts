/**
 * Searching, filtering and ordering the archive.
 *
 * @module
 */
import songData from "@/data/songs.json";
import { NO_RATING, type RatingSummary } from "./ratings";
import type { Marks } from "./social";
import type { Song } from "./song";

/**
 * Categories hidden from everybody.
 *
 * @remarks
 * The pieces stay in the spreadsheet, keep their videos in youtube.json and
 * their ratings in the database - they are only left out of the app. Remove
 * a category here to show it again.
 */
export const HIDDEN_GENRES: ReadonlySet<string> = new Set(["Choral"]);

/** Every piece in the spreadsheet, hidden ones included, in its order. */
export const ALL_SONGS: readonly Song[] = songData;

/** The pieces the app shows, in spreadsheet order. */
export const SONGS: readonly Song[] = ALL_SONGS.filter(
  (song) => song.genre === null || !HIDDEN_GENRES.has(song.genre),
);

/** How the pieces can be ordered. */
export type SortOrder = "random" | "popular" | "unrated" | "title" | "number";

/** Labels of the orders, for the selects. */
export const SORT_LABELS: Readonly<Record<SortOrder, string>> = {
  random: "Zufällig",
  popular: "Beliebteste (Sterne + Herzen)",
  unrated: "Noch nicht bewertet",
  title: "Titel A-Z",
  number: "Archiv-Nummer",
};

/** What narrows the list down. */
export type SongFilter = {
  /** Free text, matched against title, people and number. */
  readonly query: string;
  /** Only this category, or all. */
  readonly genre: string | null;
  /** Only this occasion, or all. */
  readonly occasion: string | null;
};

/** The filter that lets everything through. */
export const NO_FILTER: SongFilter = { query: "", genre: null, occasion: null };

/** What the ordering needs to know about the votes. */
export type SortContext = {
  readonly summaries: ReadonlyMap<string, RatingSummary>;
  /** The visitor's own stars per song id. */
  readonly mine: Readonly<Record<string, number>>;
  /** Fixes the random order, so it stays put while the list re-renders. */
  readonly seed: number;
  /** Who likes which piece; counts towards the popularity. */
  readonly likes?: Marks;
};

/** One category and how many pieces it holds. */
export type Category = {
  readonly name: string;
  readonly count: number;
};

/** Stars that neither raise nor lower the popularity. */
const NEUTRAL_STARS = 3;

/** Largest value of the 32 bit shuffle state. */
const UINT32_RANGE = 4_294_967_296;

/**
 * Constants of mulberry32, the seeded random generator behind the shuffle -
 * small, fast and good enough for shuffling a song list.
 */
const MULBERRY_STEP = 0x6d2b79f5;
const MULBERRY_SHIFT_A = 15;
const MULBERRY_SHIFT_B = 7;
const MULBERRY_SHIFT_C = 14;
const MULBERRY_MIX = 61;

/**
 * The categories of one field, largest first.
 *
 * @param songs - the pieces to count
 * @param field - which column to group by
 * @returns each value that occurs, with its count
 */
export function categories(
  songs: readonly Song[],
  field: "genre" | "occasion",
): readonly Category[] {
  const counts = new Map<string, number>();
  for (const song of songs) {
    const name = song[field];
    if (name !== null) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"));
}

/**
 * The pieces that pass a filter.
 *
 * @param songs - the pieces to search
 * @param filter - what to keep
 * @returns the matching pieces, order unchanged
 */
export function filterSongs(
  songs: readonly Song[],
  filter: SongFilter,
): readonly Song[] {
  const words = normalize(filter.query).split(" ").filter(Boolean);
  return songs.filter(
    (song) =>
      (filter.genre === null || song.genre === filter.genre) &&
      (filter.occasion === null || song.occasion === filter.occasion) &&
      words.every((word) => searchText(song).includes(word)),
  );
}

/**
 * The pieces in the wanted order.
 *
 * @param songs - the pieces to order
 * @param order - how to order them
 * @param context - votes and the random seed
 * @returns a new, ordered array
 */
export function sortSongs(
  songs: readonly Song[],
  order: SortOrder,
  context: SortContext,
): readonly Song[] {
  const byTitle = (a: Song, b: Song) => a.title.localeCompare(b.title, "de");
  const summary = (song: Song) => context.summaries.get(song.id) ?? NO_RATING;
  let sorted: Song[];

  switch (order) {
    case "popular": {
      const points = (song: Song) =>
        popularity(
          summary(song),
          Object.keys(context.likes?.[song.id] ?? {}).length,
        );
      sorted = [...songs].sort(
        (a, b) =>
          points(b) - points(a) ||
          summary(b).average - summary(a).average ||
          byTitle(a, b),
      );
      break;
    }
    case "unrated":
      sorted = shuffle(
        songs.filter((song) => context.mine[song.id] === undefined),
        context.seed,
      );
      break;
    case "title":
      sorted = [...songs].sort(byTitle);
      break;
    case "number":
      sorted = [...songs].sort(
        (a, b) => compareNumbers(a.number, b.number) || byTitle(a, b),
      );
      break;
    default:
      sorted = shuffle(songs, context.seed);
  }

  return sorted;
}

/**
 * How popular a piece is, from its stars and hearts.
 *
 * @param summary - the piece's star votes
 * @param likes - how many people gave it a heart
 * @returns points: one per heart, and per vote the stars above or below the
 *   middle
 * @remarks
 * A five-star vote counts +2 - as much as two hearts -, four stars +1, three
 * stars nothing, and a poor vote takes points away: 2 stars -1, 1 star -2,
 * zero stars -3.
 * So a piece many people rated well or liked leads, and a piece nobody likes
 * cannot climb just by being rated often.
 */
export function popularity(summary: RatingSummary, likes: number): number {
  return likes + summary.count * (summary.average - NEUTRAL_STARS);
}

/**
 * Looks a piece up by its id.
 *
 * @param id - the song id
 * @returns the piece, or undefined if there is none
 */
export function songById(id: string): Song | undefined {
  return SONGS.find((song) => song.id === id);
}

/**
 * A shuffle that gives the same order for the same seed.
 *
 * @param items - what to shuffle
 * @param seed - a number in [0, 1)
 * @returns a new, shuffled array
 */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = Math.floor(seed * UINT32_RANGE) >>> 0;
  const random = () => {
    state = (state + MULBERRY_STEP) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> MULBERRY_SHIFT_A), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MULBERRY_SHIFT_B), t | MULBERRY_MIX);
    return ((t ^ (t >>> MULBERRY_SHIFT_C)) >>> 0) / UINT32_RANGE;
  };
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** Lowercase text without accents, for matching ("Großer" -> "grosser"). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cache of the searchable text of each piece. */
const SEARCH_TEXT = new WeakMap<Song, string>();

/** Everything a search may match in a piece. */
function searchText(song: Song): string {
  let text = SEARCH_TEXT.get(song);
  if (text === undefined) {
    text = normalize(
      [
        song.title,
        song.number,
        song.composer,
        song.arranger,
        song.publisher,
        song.solo,
        song.collection,
      ]
        .filter(Boolean)
        .join(" "),
    );
    SEARCH_TEXT.set(song, text);
  }
  return text;
}

/** Orders archive numbers like `99 < 277a < 1001`, missing ones last. */
function compareNumbers(a: string | null, b: string | null): number {
  const value = (number: string | null) =>
    number === null ? Number.POSITIVE_INFINITY : parseInt(number, 10);
  const difference = value(a) - value(b);
  return Number.isNaN(difference) || difference === 0
    ? (a ?? "").localeCompare(b ?? "", "de")
    : difference;
}
