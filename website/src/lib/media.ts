/**
 * Recordings linked to a piece: YouTube videos and the snippet to play.
 *
 * @module
 * @remarks
 * The archive itself has no recordings. Every piece can have two links:
 *
 * - the one in the catalog, kept by the admin (see catalog.ts)
 * - one a musician linked in the app, which wins over the catalog's
 */

/** A YouTube video linked to a piece. */
export type Media = {
  /** The 11 character YouTube video id. */
  readonly videoId: string;
  /** Second the snippet starts at. */
  readonly start: number;
};

/** A link from the catalog. */
export type FixedMedia = Media & {
  /** Title and channel of the video, for checking the file by hand. */
  readonly label?: string;
  /** Length of the video in seconds. */
  readonly duration?: number;
  /**
   * Second where the most watched part begins, from YouTube's "most
   * replayed" graph; null if the video has none (too few views).
   */
  readonly peak?: number | null;
  /**
   * Where YouTube's "most replayed" stretch begins, as the nightly job
   * found it - kept apart from {@link peak}, which an admin may have set to
   * a start of their own.
   */
  readonly youtubePeak?: number;
  /** Set on every catalog link, to tell it from one linked in the app. */
  readonly fixed?: true;
};

/** Where a snippet starts. */
export type SnippetStart = "start" | "middle" | "random" | "peak";

/** Earliest random start, as share of the video's length (skips intros). */
const RANDOM_FROM = 0.1;

/**
 * Whether the player has to find the start itself.
 *
 * @param media - the video
 * @param mode - the visitor's choice
 * @returns true for a fixed link whose length is not known yet
 * @remarks
 * Videos found when the club set up its catalog know their length (`npm run
 * youtube:details`). For those the admin linked later the page asks the
 * player for the length and then jumps, see {@link snippetStart}.
 */
export function needsSeek(media: FixedMedia, mode: SnippetStart): boolean {
  return (
    media.fixed === true && media.duration === undefined && mode !== "start"
  );
}

/**
 * The second a snippet starts at.
 *
 * @param media - the video; only fixed links know their length and peak
 * @param mode - the visitor's choice
 * @param random - a number in [0, 1), used by the random mode
 * @returns the start second
 * @remarks
 * Without a known length (a video a musician linked by hand) the start they
 * entered is used whatever the mode: they picked it on purpose. The peak
 * falls back to the middle for videos without a "most replayed" graph. Every
 * start leaves room for a whole snippet before the video ends.
 */
export function snippetStart(
  media: FixedMedia,
  mode: SnippetStart,
  random: number,
): number {
  const duration = media.duration ?? 0;
  const latest = Math.max(media.start, duration - SNIPPET_SECONDS);
  const middle = (duration - SNIPPET_SECONDS) / 2;
  let start: number;

  if (duration <= SNIPPET_SECONDS) {
    start = media.start;
  } else {
    switch (mode) {
      case "middle":
        start = middle;
        break;
      case "random":
        start =
          duration * RANDOM_FROM + random * (latest - duration * RANDOM_FROM);
        break;
      case "peak":
        start = media.peak ?? middle;
        break;
      default:
        start = media.start;
    }
  }

  return Math.round(Math.min(Math.max(start, media.start, 0), latest));
}

/** Shape of a YouTube video id. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Where the videos of the pieces come from. */
export type MediaSources = {
  /** The links musicians made in the app, by song id. */
  readonly media: Readonly<Record<string, Media>>;
  /** The catalog's links, by song id. */
  readonly catalog: { readonly videos: Readonly<Record<string, FixedMedia>> };
};

/**
 * The video a piece plays.
 *
 * @param sources - the musicians' and the catalog's links
 * @param songId - which piece
 * @returns the musicians' link if there is one, else the catalog's
 */
export function mediaFor(
  sources: MediaSources,
  songId: string,
): FixedMedia | undefined {
  return sources.media[songId] ?? sources.catalog.videos[songId];
}

/**
 * Seconds a start leaves before the end of the video.
 *
 * @remarks
 * The piece then plays on to its end; this only keeps a start in the middle
 * or at the peak from landing in the last few bars.
 */
export const SNIPPET_SECONDS = 45;

/** Hosts YouTube serves videos from. */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Short link host, the id being the path. */
const SHORT_HOST = "youtu.be";

/** Path prefixes after which the id follows directly. */
const ID_PATHS = ["/embed/", "/shorts/", "/live/", "/v/"];

/** Seconds per minute and per hour, for `t=1h2m3s`. */
const SECONDS_PER: Readonly<Record<string, number>> = {
  h: 3600,
  m: 60,
  s: 1,
};

/**
 * Reads a YouTube link or bare video id.
 *
 * @param input - what the musician pasted
 * @returns the video and the start time from a `t=` or `start=` parameter,
 *   or null if it is not a YouTube video
 * @example
 * ```ts
 * parseYouTube("https://youtu.be/dQw4w9WgXcQ?t=42"); // { videoId: "dQw4w9WgXcQ", start: 42 }
 * ```
 */
export function parseYouTube(input: string): Media | null {
  const text = input.trim();
  let result: Media | null = null;

  if (VIDEO_ID.test(text)) {
    result = { videoId: text, start: 0 };
  } else {
    const url = toUrl(text);
    const videoId = url === null ? null : videoIdOf(url);
    if (url !== null && videoId !== null) {
      const time =
        url.searchParams.get("t") ?? url.searchParams.get("start") ?? "";
      result = { videoId, start: parseTime(time) };
    }
  }

  return result;
}

/**
 * Whether a value read from the database is a usable link.
 *
 * @param value - anything
 * @returns true if it has a valid video id and a start time
 */
export function isMedia(value: unknown): value is Media {
  const media = value as Media | null;
  return (
    typeof media === "object" &&
    media !== null &&
    typeof media.videoId === "string" &&
    VIDEO_ID.test(media.videoId) &&
    typeof media.start === "number" &&
    media.start >= 0
  );
}

/**
 * The player address for a video.
 *
 * @param media - the linked video
 * @param muted - whether to start without sound
 * @param start - the second to start at, by default the link's own start
 * @param loop - whether to start over at the end by itself
 * @returns an embed URL on the privacy-enhanced YouTube domain
 * @remarks
 * Without YouTube's own controls, keyboard and annotations: the page draws
 * its own timeline and steers the player by message (`enablejsapi`). Looping
 * is left to the player - telling it to jump back would show YouTube's own
 * button.
 */
export function embedUrl(
  media: Media,
  muted: boolean,
  start = media.start,
  loop = false,
): string {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    start: String(start),
    controls: "0",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    playsinline: "1",
    rel: "0",
    enablejsapi: "1",
    // YouTube loops a single video only as a playlist of itself.
    ...(loop ? { loop: "1", playlist: media.videoId } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${media.videoId}?${params}`;
}

/**
 * A plain player for looking at a video, with YouTube's own controls.
 *
 * @param media - the video
 * @param start - the second to start at
 * @returns an embed URL on the privacy-enhanced YouTube domain
 * @remarks
 * For the admin page, where the video is checked rather than swiped past.
 */
export function previewUrl(media: Media, start: number): string {
  const params = new URLSearchParams({
    autoplay: "1",
    start: String(start),
    playsinline: "1",
    rel: "0",
    // Reports the playing time, for picking a start, see usePlayerReports.
    enablejsapi: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${media.videoId}?${params}`;
}

/**
 * The preview image of a video.
 *
 * @param media - the linked video
 * @returns the address of YouTube's still image
 */
export function thumbnailUrl(media: Media): string {
  return `https://i.ytimg.com/vi/${media.videoId}/hqdefault.jpg`;
}

/**
 * The full video on YouTube, at the snippet's start.
 *
 * @param media - the linked video
 * @returns a watch URL
 */
export function watchUrl(media: Media): string {
  return `https://www.youtube.com/watch?v=${media.videoId}&t=${media.start}s`;
}

/**
 * A YouTube search for a piece.
 *
 * @param query - title and composer
 * @returns a search URL
 */
export function searchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** Parses a URL, adding the scheme people tend to leave out. */
function toUrl(text: string): URL | null {
  let url: URL | null = null;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    // Not a URL at all.
  }
  return url;
}

/** Finds the video id in a YouTube URL. */
function videoIdOf(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;

  if (host === SHORT_HOST) {
    candidate = url.pathname.slice(1).split("/")[0];
  } else if (YOUTUBE_HOSTS.has(host)) {
    const prefix = ID_PATHS.find((path) => url.pathname.startsWith(path));
    candidate =
      prefix === undefined
        ? url.searchParams.get("v")
        : url.pathname.slice(prefix.length).split("/")[0];
  }

  return candidate !== null && VIDEO_ID.test(candidate) ? candidate : null;
}

/** Reads `90`, `90s` or `1m30s` as seconds. */
function parseTime(time: string): number {
  let seconds = 0;
  if (/^\d+$/.test(time)) {
    seconds = Number(time);
  } else {
    for (const [, amount, unit] of time.matchAll(/(\d+)([hms])/g)) {
      seconds += Number(amount) * (SECONDS_PER[unit] ?? 0);
    }
  }
  return seconds;
}
