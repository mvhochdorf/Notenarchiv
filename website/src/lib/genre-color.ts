/**
 * A colour per category, so a march looks different from a chorale at a
 * glance.
 *
 * @module
 */

/** Degrees on the colour wheel. */
const HUES = 360;

/** Multiplier of the string hash. */
const HASH_FACTOR = 31;

/**
 * The hue of a category.
 *
 * @param genre - the category, or null
 * @returns a hue in degrees, the same for the same category
 * @remarks
 * Derived from the name rather than listed, so a category that appears in the
 * spreadsheet later gets a colour without anybody choosing one.
 */
export function genreHue(genre: string | null): number {
  let hash = 0;
  for (const char of genre ?? "") {
    hash = (hash * HASH_FACTOR + (char.codePointAt(0) ?? 0)) % HUES;
  }
  return hash;
}
