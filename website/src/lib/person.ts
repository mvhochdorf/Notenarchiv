/**
 * Who a visitor is: their name, and the id their stars and comments are kept
 * under on every device.
 *
 * @module
 * @remarks
 * Firebase signs every browser in anonymously, each with an id of its own -
 * a musician with a phone and a laptop would be two people, with two votes
 * per piece. So the app asks for first and last name once per device and
 * keeps everything under an id made from the name. Each device notes in the
 * database which person it belongs to, and the security rules let it write
 * only under that person.
 *
 * This is not a login: whoever types somebody else's name can rate as them.
 * Within a band that is a fair trade for not needing passwords.
 */
import { slugify } from "./song";

/** Longest first or last name, in characters. */
export const MAX_NAME_PART = 40;

/**
 * The id a person's data is kept under.
 *
 * @param firstName - as entered
 * @param lastName - as entered
 * @returns e.g. `max-mustermann`; empty if a part is missing
 * @example
 * ```ts
 * personId(" Jürgen ", "Groß"); // "juergen-gross"
 * ```
 */
export function personId(firstName: string, lastName: string): string {
  const first = slugify(firstName);
  const last = slugify(lastName);
  return first === "" || last === "" ? "" : `${first}-${last}`;
}

/**
 * The name shown to others.
 *
 * @param firstName - as entered
 * @param lastName - as entered
 * @returns both parts, trimmed, with one space between
 */
export function displayName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
