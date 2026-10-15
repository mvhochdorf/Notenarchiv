/**
 * One piece of sheet music from the archive and how it is identified.
 *
 * @module
 */

/** A piece of the archive. */
export type Song = {
  /**
   * Stable key for the database.
   *
   * @remarks
   * Built from the archive number and the title when the piece is added,
   * see {@link songId}, and kept from then on - also when the admin
   * corrects number or title. Ratings, likes and comments are stored under
   * it.
   */
  readonly id: string;
  /** Archive number ("Neue Nr."), may carry a letter like `1553a`. */
  readonly number: string | null;
  readonly title: string;
  /** Category ("Sparte"), e.g. Märsche or Konzert. */
  readonly genre: string | null;
  /** Occasion ("Anlass"), e.g. Weihnacht or Kirche. */
  readonly occasion: string | null;
  /** Solo instrument, if the piece features one. */
  readonly solo: string | null;
  readonly composer: string | null;
  readonly arranger: string | null;
  readonly publisher: string | null;
  /** Position inside the folder ("Nr. im Ordner"). */
  readonly folderNumber: string | null;
  /** Book or collection the piece is part of ("Sammlung/Heft"). */
  readonly collection: string | null;
  /** Day the piece came into the archive, `YYYY-MM-DD`; orders "Neu". */
  readonly added?: string;
  /** Person id of the musician who added it in the app, if one did. */
  readonly addedBy?: string;
};

/** Longest slug part taken from a title. */
const MAX_SLUG_LENGTH = 48;

/** Replacements for characters a plain ASCII slug cannot hold. */
const UMLAUTS: Readonly<Record<string, string>> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
};

/**
 * Builds the database key of a piece.
 *
 * @param number - the archive number, if there is one
 * @param title - the title of the piece
 * @returns a key made of `a-z`, `0-9` and `-`, safe for Firebase paths
 * @example
 * ```ts
 * songId("1553a", "Aber Dich gibt's nur einmal"); // "1553a-aber-dich-gibt-s-nur-einmal"
 * ```
 */
export function songId(number: string | null, title: string): string {
  const parts = [number ?? "", slugify(title)].filter((part) => part !== "");
  return slugify(parts.join("-"));
}

/**
 * Makes every id in a list unique by numbering repeats.
 *
 * @param ids - ids in list order, possibly with duplicates
 * @returns the same ids, the second `x` becoming `x-2`, the third `x-3`
 * @remarks
 * The archive holds a few pieces twice (two sets of the same title under one
 * number). Numbering in list order keeps the result stable between imports as
 * long as the spreadsheet is only appended to.
 */
export function uniqueIds(ids: readonly string[]): readonly string[] {
  const seen = new Map<string, number>();
  return ids.map((id) => {
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}-${count}`;
  });
}

/**
 * Lowercase ASCII slug of a text.
 *
 * @param text - any text
 * @returns the text as `a-z`, `0-9` and `-`, umlauts spelled out
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}
