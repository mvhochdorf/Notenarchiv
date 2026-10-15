/**
 * Finds a YouTube recording for every piece and fixes it in youtube.json.
 *
 * @module
 * @remarks
 * Run with `npm run youtube`. Reads the YouTube search page (no API key
 * needed), scores the results and keeps the best one per piece in
 * `verein/youtube.json`. Pieces already in the file are skipped, so the
 * script can be stopped and resumed, and links corrected by hand stay as
 * they are. `--retry` searches again for the pieces that got no link,
 * `--upgrade` for the linked ones that are no band recording (and replaces
 * the link only if it finds one), `--limit=20` stops after twenty pieces.
 *
 * A result only counts when most words of the title appear in the video
 * title and the video is a single piece rather than a whole concert. Band
 * recordings are what the archive is for, so a hint at one in title or
 * channel - Blasorchester, Musikverein, Concert Band - weighs most; the
 * original of a pop song or a piano version counts against a result. The
 * composer, arranger or publisher showing up raises the score too -
 * publishers like Rundel or De Haske upload demo recordings of their
 * editions, which are exactly the arrangements in the archive.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FixedMedia } from "../src/lib/media";
import { CLUB } from "../src/lib/club";
import type { Song } from "../src/lib/song";
import { loadPage, PAUSE_MS, pageData, sleep } from "./youtube-page.mjs";

/** Song list written by the import. */
const SONGS_FILE = fileURLToPath(
  new URL("../verein/songs.json", import.meta.url),
);

/** Where the links go. */
const TARGET = fileURLToPath(
  new URL("../verein/youtube.json", import.meta.url),
);

/**
 * Marks links the club entered itself; no search ever replaces them.
 *
 * @remarks
 * Put it at the end of the `label` when adding a link to youtube.json by
 * hand.
 */
const BY_HAND = "(vom Verein eingetragen)";

/** Marks pieces that were searched without success. */
const NOT_FOUND = "nicht gefunden";

/** Shortest and longest plausible recording of one piece, in seconds. */
const MIN_SECONDS = 40;
const MAX_SECONDS = 900;

/** Share of title words that must appear in the video title. */
const MIN_TITLE_MATCH = 0.75;

/** Score a result needs to be taken. */
const MIN_SCORE = 2.5;

/** Score weights. */
const WEIGHT_TITLE = 3;
const WEIGHT_PERSON = 1.5;
const WEIGHT_PUBLISHER = 1;
const WEIGHT_BAND = 1.5;
const WEIGHT_NOT_BAND = -1.5;
const WEIGHT_RANK = 0.05;
const RANKS_WEIGHTED = 10;

/**
 * Surnames of the club's own arrangers, as normalized words.
 *
 * @remarks
 * Their arrangements are not on YouTube, so searching for the name only
 * finds nothing - the search goes by title and band music instead. Set in
 * `verein/config.json` (`search.internalArrangers`).
 */
const INTERNAL_NAMES = CLUB.search.internalArrangers.map(normalize);

/**
 * How a title from the spreadsheet is spelled on YouTube.
 *
 * @remarks
 * The spreadsheet stays as it is; these only fix the search for titles
 * spelled differently there. Set in `verein/config.json`
 * (`search.spellings`).
 */
const SEARCH_SPELLINGS: Readonly<Record<string, string>> =
  CLUB.search.spellings;

/** Shortest name part that is matched. */
const MIN_NAME_LENGTH = 4;

/** Words that point to a band recording rather than a pop original. */
const BAND_WORDS = [
  "blasorchester",
  "blaskapelle",
  "blasmusik",
  "musikverein",
  "musikkapelle",
  "stadtkapelle",
  "harmonie",
  "concert band",
  "wind band",
  "wind orchestra",
  "brass band",
  "posaunenchor",
  "fanfare",
  "blaser",
  "musikkorps",
  "heeresmusik",
  "polizeiorchester",
  "jugendkapelle",
  "jugendorchester",
  "egerlander",
  "bohmische",
  "harmoniemusik",
  "musikgesellschaft",
  "feuerwehrkapelle",
  "trachtenkapelle",
  "symphonic band",
  "military band",
  "marching band",
  "wind ensemble",
  "banda",
  "orkiestra deta",
  "rundel",
  "de haske",
  "hal leonard",
];

/** Words that point to something other than a band playing the piece. */
const NOT_BAND_WORDS = [
  "official video",
  "official music video",
  "official audio",
  "music video",
  "piano",
  "klavier",
  "guitar",
  "gitarre",
  "orgel",
  "organ",
  "acapella",
  "a cappella",
  "choir",
  "chor",
  "remix",
];

/** Seconds per minute, and minutes per hour. */
const SECONDS_PER_MINUTE = 60;

/** Words that point to anything but a performance of the piece. */
const BAD_WORDS = [
  "lyrics",
  "karaoke",
  "reaction",
  "tutorial",
  "lesson",
  "play along",
  "playalong",
  "backing track",
  "sheet music",
  "noten",
  "trailer",
];

/** Spaces in JSON output. */
const JSON_INDENT = 2;

/** One search result. */
type Result = {
  readonly videoId: string;
  readonly title: string;
  readonly channel: string;
  readonly seconds: number;
};

/** A stored entry: a link, or the note that nothing was found. */
type Entry = FixedMedia | { readonly label: string };

const songs = JSON.parse(readFileSync(SONGS_FILE, "utf8")) as Song[];
const links = (
  existsSync(TARGET) ? JSON.parse(readFileSync(TARGET, "utf8")) : {}
) as Record<string, Entry>;
const retry = process.argv.includes("--retry");
const upgrade = process.argv.includes("--upgrade");
const limit = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
    Number.POSITIVE_INFINITY,
);

await main();

/** Searches every piece that still needs a link. */
async function main(): Promise<void> {
  const todo = songs
    .filter((song) => {
      const entry = links[song.id];
      return (
        entry === undefined ||
        (retry &&
          !("videoId" in entry) &&
          !(entry.label ?? "").includes(BY_HAND)) ||
        (upgrade &&
          "videoId" in entry &&
          !isBandLabel(entry.label ?? "") &&
          !(entry.label ?? "").includes(BY_HAND))
      );
    })
    .slice(0, limit);
  console.log(`${todo.length} von ${songs.length} Stücken werden gesucht.`);

  let found = 0;
  for (const [index, song] of todo.entries()) {
    const best = await findVideo(song);
    const entry = links[song.id];
    const keep =
      entry !== undefined &&
      "videoId" in entry &&
      (best === null || !isBandLabel(label(best)));
    if (!keep) {
      // An upgrade only swaps a link for a band recording.
      links[song.id] =
        best === null
          ? { label: NOT_FOUND }
          : {
              videoId: best.videoId,
              start: 0,
              duration: best.seconds,
              label: label(best),
            };
    }
    found += best === null || keep ? 0 : 1;
    console.log(
      `[${index + 1}/${todo.length}] ${song.title} -> ${links[song.id].label}`,
    );
    save();
    await sleep(PAUSE_MS);
  }
  console.log(`Fertig: ${found} von ${todo.length} neu verknüpft.`);
}

/** What is noted about a result in the file: title and channel. */
function label(result: Result): string {
  return `${result.title} | ${result.channel}`;
}

/** Whether a noted title and channel point to a band recording. */
function isBandLabel(text: string): boolean {
  const words = ` ${normalize(text)} `;
  return BAND_WORDS.some((word) => words.includes(` ${word}`));
}

/**
 * Searches by composer or arranger and as band music, keeps the best.
 *
 * @remarks
 * Pieces searched again with `--retry` get more searches: composer and
 * arranger separately, "Blasmusik", and the bare title.
 */
async function findVideo(song: Song): Promise<Result | null> {
  const title = searchTitle(song.title);
  const arranger = publicSurname(song.arranger);
  const composer = publicSurname(song.composer);
  const kind =
    (song.genre === null
      ? undefined
      : CLUB.search.bandQueryByGenre[song.genre]) ?? CLUB.search.bandQuery;
  const wanted = retry
    ? [
        `${title} ${composer ?? ""}`,
        `${title} ${arranger ?? ""}`,
        `${title} ${kind}`,
        `${title} Blasmusik`,
        title,
      ]
    : [`${title} ${arranger ?? composer ?? ""}`, `${title} ${kind}`];
  const queries = [...new Set(wanted.map((query) => query.trim()))];

  const results: Result[] = [];
  for (const query of queries) {
    for (const result of await search(query)) {
      if (!results.some((other) => other.videoId === result.videoId)) {
        results.push(result);
      }
    }
    await sleep(PAUSE_MS);
  }
  return pick(song, results);
}

/** The best scoring result, if one is good enough. */
function pick(song: Song, results: readonly Result[]): Result | null {
  const words = normalize(searchTitle(song.title))
    .split(" ")
    .filter((word) => word.length > 1);
  const names = [song.composer, song.arranger]
    .flatMap((name) => normalize(name ?? "").split(" "))
    .filter(
      (part) =>
        part.length >= MIN_NAME_LENGTH &&
        part !== "div" &&
        !INTERNAL_NAMES.includes(part),
    );
  const publisher = normalize(song.publisher ?? "")
    .split(" ")
    .filter((part) => part.length >= MIN_NAME_LENGTH);

  let best: Result | null = null;
  let bestScore = MIN_SCORE;
  for (const [rank, result] of results.entries()) {
    const text = normalize(`${result.title} ${result.channel}`);
    const videoTitle = ` ${normalize(result.title)} `;
    const match =
      words.length === 0
        ? 0
        : words.filter((word) => videoTitle.includes(` ${word} `)).length /
          words.length;
    const band = BAND_WORDS.some((word) => ` ${text}`.includes(` ${word}`));
    const notBand = NOT_BAND_WORDS.some((word) =>
      ` ${text} `.includes(` ${word} `),
    );
    // A one-word title like "Air" is found in far too many other titles: the
    // video has to start with it or at least be a band recording.
    const shortOk =
      words.length > 1 || videoTitle.startsWith(` ${words[0]} `) || band;
    const plausible =
      match >= MIN_TITLE_MATCH &&
      shortOk &&
      !BAD_WORDS.some((word) => ` ${text} `.includes(` ${word} `)) &&
      result.seconds >= MIN_SECONDS &&
      result.seconds <= MAX_SECONDS;
    if (plausible) {
      const score =
        match * WEIGHT_TITLE +
        (names.some((name) => text.includes(name)) ? WEIGHT_PERSON : 0) +
        (publisher.some((name) => text.includes(name)) ? WEIGHT_PUBLISHER : 0) +
        (band ? WEIGHT_BAND : 0) +
        (notBand && !band ? WEIGHT_NOT_BAND : 0) +
        Math.max(0, RANKS_WEIGHTED - rank) * WEIGHT_RANK;
      if (score > bestScore) {
        best = result;
        bestScore = score;
      }
    }
  }
  return best;
}

/** Loads one YouTube search page and reads the videos out of it. */
async function search(query: string): Promise<Result[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=de&gl=DE`;
  const results: Result[] = [];
  collect(pageData(await loadPage(url), "ytInitialData"), results);
  return results;
}

/** Walks the page data and keeps every video entry. */
function collect(node: unknown, results: Result[]): void {
  if (typeof node === "object" && node !== null) {
    const video = (node as { videoRenderer?: VideoRenderer }).videoRenderer;
    if (video !== undefined) {
      results.push({
        videoId: video.videoId,
        title: video.title?.runs?.map((run) => run.text).join("") ?? "",
        channel: video.ownerText?.runs?.map((run) => run.text).join("") ?? "",
        seconds: toSeconds(video.lengthText?.simpleText ?? ""),
      });
    } else {
      for (const child of Object.values(node)) {
        collect(child, results);
      }
    }
  }
}

/** The part of YouTube's page data that describes one video. */
type VideoRenderer = {
  readonly videoId: string;
  readonly title?: { readonly runs?: readonly { readonly text: string }[] };
  readonly ownerText?: { readonly runs?: readonly { readonly text: string }[] };
  readonly lengthText?: { readonly simpleText?: string };
};

/** Reads `4:05` or `1:02:03` as seconds; 0 for live streams. */
function toSeconds(length: string): number {
  return length === ""
    ? 0
    : length
        .split(":")
        .reduce((total, part) => total * SECONDS_PER_MINUTE + Number(part), 0);
}

/** The title without notes like `(tour)` or ` - Prozessionsmarsch`. */
function searchTitle(title: string): string {
  return (SEARCH_SPELLINGS[title] ?? title)
    .replace(/\(.*?\)/g, " ")
    .replace(/\bA\d\s*-?\s*Format\b/gi, " ")
    .replace(/\s-\s.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** A surname worth searching for: none for the club's own arrangers. */
function publicSurname(name: string | null): string | null {
  const found = surname(name);
  return found !== null && INTERNAL_NAMES.includes(normalize(found))
    ? null
    : found;
}

/** Last name of `W.Löffler`, `Philip Sparke` or `Anderson/Ulvaeus`. */
function surname(name: string | null): string | null {
  const part = (name ?? "")
    .split("/")[0]
    .split(/[\s.]+/)
    .filter(Boolean)
    .pop();
  return part === undefined || part.length < MIN_NAME_LENGTH ? null : part;
}

/** Lowercase words without accents and punctuation. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Writes the file, sorted by id so diffs stay readable. */
function save(): void {
  const sorted = Object.fromEntries(
    Object.entries(links).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(TARGET, `${JSON.stringify(sorted, null, JSON_INDENT)}\n`);
}
