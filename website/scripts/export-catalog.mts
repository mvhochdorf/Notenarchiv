/**
 * Puts a new club's start set together as one file for the Firebase
 * console.
 *
 * @module
 * @remarks
 * The last step after `npm run import` (spreadsheet -> `verein/songs.json`)
 * and, if wanted, `npm run youtube` and `npm run youtube:details` (videos ->
 * `verein/youtube.json`). The result, `verein/catalog-import.json`, is
 * imported once in the Firebase console at `notenarchiv/catalog`; from then
 * on the pieces are kept on the admin page. See docs/neuer-verein.md. None
 * of these files are committed.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalogEntries, startCatalog } from "../src/lib/catalog";
import type { Song } from "../src/lib/song";

/** A file in `verein/`. */
const inClub = (name: string) =>
  fileURLToPath(new URL(`../verein/${name}`, import.meta.url));

/** Spaces in JSON output. */
const JSON_INDENT = 2;

/** Reads a JSON file, or the fallback when it is not there. */
function readJson<T>(name: string, fallback: T): T {
  const path = inClub(name);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as T)
    : fallback;
}

const catalog = startCatalog(
  readJson<Song[]>("songs.json", []),
  readJson<Record<string, unknown>>("youtube.json", {}),
  readJson<Record<string, string>>("added.json", {}),
);
const entries = catalogEntries(catalog);
const target = inClub("catalog-import.json");
writeFileSync(target, `${JSON.stringify(entries, null, JSON_INDENT)}\n`);
console.log(
  `${Object.keys(entries).length} Stücke nach ${target} geschrieben - in der Firebase-Konsole bei notenarchiv/catalog importieren.`,
);
