/**
 * The catalog: every piece of the archive with its video, as the admin keeps
 * it.
 *
 * @module
 * @remarks
 * Lives in the database under `notenarchiv/catalog/{songId}` - one
 * {@link CatalogEntry} per piece - and is changed on the admin page
 * (`/verwaltung/`). A new club fills it once from its spreadsheet, see
 * {@link startCatalog} and docs/neuer-verein.md.
 */
import { byArchiveNumber } from "./library";
import { isMedia, type FixedMedia } from "./media";
import { songId, type Song } from "./song";

/** Every piece and its video. */
export type Catalog = {
  /** Every piece, hidden categories included, by archive number. */
  readonly songs: readonly Song[];
  /** The video of each piece that has one, by song id. */
  readonly videos: Readonly<Record<string, FixedMedia>>;
  /** Pieces the admin noted as having no recording to be found. */
  readonly noVideo: ReadonlySet<string>;
};

/** The text fields of a piece, in the order the admin page shows them. */
export const SONG_FIELDS = [
  "number",
  "title",
  "genre",
  "occasion",
  "solo",
  "composer",
  "arranger",
  "publisher",
  "folderNumber",
  "collection",
] as const;

/** One text field of a piece. */
export type SongField = (typeof SONG_FIELDS)[number];

/** A video as stored in the catalog. */
export type StoredVideo = {
  readonly videoId: string;
  readonly start: number;
  readonly duration?: number;
  readonly peak?: number;
  readonly label?: string;
};

/**
 * One piece as stored in the database.
 *
 * @remarks
 * Empty fields are left out - the database cannot hold null.
 */
export type CatalogEntry = Partial<Record<SongField, string>> & {
  readonly title: string;
  readonly added: string;
  /** Person id of the musician who added it in the app. */
  readonly addedBy?: string;
  readonly video?: StoredVideo;
  /** The admin found no recording; the search leaves the piece alone. */
  readonly noVideo?: true;
};

/** Longest text of a field, as the database rules allow. */
export const MAX_FIELD_LENGTH = 200;

/** Shape of a day, `YYYY-MM-DD`. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Id of a new piece whose title holds no letters or digits at all. */
const FALLBACK_ID = "stueck";

/** What the YouTube search notes for a piece the club has no video for. */
const NO_VIDEO_LABEL = "(vom Verein eingetragen)";

/** No pieces at all: before the database answered, or without Firebase. */
export const EMPTY_CATALOG: Catalog = {
  songs: [],
  videos: {},
  noVideo: new Set(),
};

/**
 * Reads the catalog from the database.
 *
 * @param value - the `notenarchiv/catalog` node
 * @returns the catalog, or null when the database holds none yet
 * @remarks
 * Malformed entries are skipped, so one bad write cannot break the app.
 */
export function catalogOf(value: unknown): Catalog | null {
  const songs: Song[] = [];
  const videos: Record<string, FixedMedia> = {};
  const noVideo = new Set<string>();

  for (const [id, raw] of Object.entries(
    (value ?? {}) as Record<string, unknown>,
  )) {
    const entry = raw as Partial<Record<string, unknown>> | null;
    if (typeof entry?.title === "string" && entry.title !== "") {
      const text = (field: SongField) =>
        typeof entry[field] === "string" && entry[field] !== ""
          ? (entry[field] as string)
          : null;
      songs.push({
        id,
        number: text("number"),
        title: entry.title,
        genre: text("genre"),
        occasion: text("occasion"),
        solo: text("solo"),
        composer: text("composer"),
        arranger: text("arranger"),
        publisher: text("publisher"),
        folderNumber: text("folderNumber"),
        collection: text("collection"),
        ...(typeof entry.added === "string" ? { added: entry.added } : {}),
        ...(typeof entry.addedBy === "string"
          ? { addedBy: entry.addedBy }
          : {}),
      });
      const video = videoOf(entry.video);
      if (video !== undefined) {
        videos[id] = video;
      }
      if (entry.noVideo === true) {
        noVideo.add(id);
      }
    }
  }

  return songs.length === 0
    ? null
    : { songs: songs.sort(byArchiveNumber), videos, noVideo };
}

/**
 * A piece as the database stores it.
 *
 * @param song - the piece
 * @param video - its video, if it has one
 * @param noVideo - whether the admin noted it has none
 * @returns the entry, empty fields left out
 */
export function entryOf(
  song: Song,
  video: FixedMedia | undefined,
  noVideo: boolean,
): CatalogEntry {
  const fields: Partial<Record<SongField, string>> = {};
  for (const field of SONG_FIELDS) {
    const value = song[field]?.trim() ?? "";
    if (value !== "") {
      fields[field] = value.slice(0, MAX_FIELD_LENGTH);
    }
  }
  return {
    ...fields,
    title: song.title.trim().slice(0, MAX_FIELD_LENGTH),
    added:
      song.added !== undefined && DAY.test(song.added) ? song.added : today(),
    ...(song.addedBy === undefined ? {} : { addedBy: song.addedBy }),
    ...(video === undefined ? {} : { video: storedVideo(video) }),
    ...(video === undefined && noVideo ? { noVideo: true as const } : {}),
  };
}

/**
 * The whole catalog as the database stores it.
 *
 * @param catalog - every piece and video
 * @returns the entries by song id
 */
export function catalogEntries(catalog: Catalog): Record<string, CatalogEntry> {
  return Object.fromEntries(
    catalog.songs.map((song) => [
      song.id,
      entryOf(song, catalog.videos[song.id], catalog.noVideo.has(song.id)),
    ]),
  );
}

/**
 * The id of a new piece.
 *
 * @param number - its archive number, if any
 * @param title - its title
 * @param taken - the ids already in use
 * @returns an id built like the imported ones, numbered on when taken
 */
export function newSongId(
  number: string | null,
  title: string,
  taken: ReadonlySet<string>,
): string {
  const base = songId(number, title) || FALLBACK_ID;
  let id = base;
  for (let count = 2; taken.has(id); count++) {
    id = `${base}-${count}`;
  }
  return id;
}

/**
 * Today as the catalog notes days.
 *
 * @returns e.g. `2026-10-15`
 */
export function today(): string {
  return new Date().toISOString().slice(0, "YYYY-MM-DD".length);
}

/** A video in the shape the database stores, unknown values left out. */
function storedVideo(video: FixedMedia): StoredVideo {
  return {
    videoId: video.videoId,
    start: Math.max(0, Math.floor(video.start)),
    ...(typeof video.duration === "number" ? { duration: video.duration } : {}),
    ...(typeof video.peak === "number" ? { peak: video.peak } : {}),
    ...(typeof video.label === "string" && video.label !== ""
      ? { label: video.label.slice(0, MAX_FIELD_LENGTH) }
      : {}),
  };
}

/** A stored video, checked, as the player takes it. */
function videoOf(value: unknown): FixedMedia | undefined {
  const video = (value ?? {}) as Partial<StoredVideo>;
  return isMedia(value)
    ? {
        videoId: value.videoId,
        start: value.start,
        ...(typeof video.duration === "number"
          ? { duration: video.duration }
          : {}),
        ...(typeof video.peak === "number" ? { peak: video.peak } : {}),
        ...(typeof video.label === "string" ? { label: video.label } : {}),
        fixed: true,
      }
    : undefined;
}

/**
 * Puts a club's start set together.
 *
 * @param songData - the pieces read from the spreadsheet (`npm run import`)
 * @param found - the videos the search found (`npm run youtube`)
 * @param added - the day each piece came in
 * @returns the catalog to import into the database
 */
export function startCatalog(
  songData: readonly Song[],
  found: Readonly<Record<string, unknown>>,
  added: Readonly<Record<string, string>>,
): Catalog {
  const videos: Record<string, FixedMedia> = {};
  const noVideo = new Set<string>();
  for (const [id, entry] of Object.entries(found)) {
    const video = videoOf(entry);
    if (video !== undefined) {
      videos[id] = video;
    } else if (
      String((entry as { label?: unknown } | null)?.label ?? "").includes(
        NO_VIDEO_LABEL,
      )
    ) {
      noVideo.add(id);
    }
  }
  const songs: readonly Song[] = songData.map((song) => ({
    ...song,
    ...(added[song.id] === undefined ? {} : { added: added[song.id] }),
  }));
  return { songs: [...songs].sort(byArchiveNumber), videos, noVideo };
}
