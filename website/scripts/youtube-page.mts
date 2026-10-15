/**
 * Loads a YouTube page and reads the data the page is built from.
 *
 * @module
 * @remarks
 * Shared by the scripts that find and describe the archive's videos. No API
 * key is needed: every YouTube page carries its content as one JSON object
 * (`ytInitialData`), plus the player data (`ytInitialPlayerResponse`) on a
 * watch page.
 */

import { SNIPPET_SECONDS } from "../src/lib/media";

/** Pause between two page loads, to stay a polite visitor. */
export const PAUSE_MS = 1200;

/** What a browser would send. */
const HEADERS = {
  "Accept-Language": "de-DE,de;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};

/** Milliseconds per second. */
const MS = 1000;

/**
 * Part of the video never taken as peak, as share of its length.
 *
 * @remarks
 * The graph always peaks at the very start - every viewer begins there - so
 * the opening is left out.
 */
const SKIP_SHARE = 0.08;

/** Shortest opening left out, in seconds. */
const SKIP_MIN_SECONDS = 10;

/** One bar of the "most replayed" graph. */
type HeatMarker = {
  readonly startMillis: string;
  readonly durationMillis: string;
  readonly intensityScoreNormalized: number;
};

/** Length and most watched part of a video. */
export type VideoDetails = {
  /** Length in seconds. */
  readonly duration: number;
  /**
   * Second where the most watched stretch of a snippet's length begins, from
   * YouTube's "most replayed" graph; null when YouTube shows none (videos
   * with few views).
   */
  readonly peak: number | null;
};

/**
 * Loads a video's watch page and reads its length and peak.
 *
 * @param videoId - the 11 character YouTube id
 * @returns the details, or null when the page could not be read
 */
export async function describeVideo(
  videoId: string,
): Promise<VideoDetails | null> {
  const html = await loadPage(
    `https://www.youtube.com/watch?v=${videoId}&hl=de`,
  );
  const duration = Number(/"lengthSeconds":"(\d+)"/.exec(html)?.[1] ?? NaN);
  return Number.isFinite(duration) && duration > 0
    ? {
        duration,
        peak: peakStart(heatMarkers(pageData(html, "ytInitialData")), duration),
      }
    : null;
}

/**
 * Loads a page's HTML.
 *
 * @param url - the YouTube address
 * @returns the HTML, or an empty string if loading failed
 */
export async function loadPage(url: string): Promise<string> {
  let html = "";
  try {
    html = await (await fetch(url, { headers: HEADERS })).text();
  } catch (error) {
    console.warn(`Laden fehlgeschlagen: ${url}`, error);
  }
  return html;
}

/**
 * Reads a JSON object a page assigns to a variable.
 *
 * @param html - the page
 * @param name - the variable, e.g. `ytInitialData`
 * @returns the parsed object, or null if the page has none
 */
export function pageData(html: string, name: string): unknown {
  const marker = `var ${name} = `;
  const from = html.indexOf(marker);
  const json = from < 0 ? null : balancedObject(html, from + marker.length);
  let data: unknown = null;
  try {
    data = json === null ? null : JSON.parse(json);
  } catch {
    // A page layout this script does not know - treat as empty.
  }
  return data;
}

/**
 * Waits a while.
 *
 * @param ms - how long, in milliseconds
 * @returns a promise that resolves after that time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The JSON object starting at a position, up to its matching brace.
 *
 * @remarks
 * Counts braces outside of strings. A pattern like `\{.*?\});</script>`
 * is not enough: video descriptions may contain that very text and cut the
 * object short.
 */
function balancedObject(text: string, from: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = from; index < text.length && end < 0; index++) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      end = depth === 0 ? index + 1 : -1;
    }
  }
  return end < 0 ? null : text.slice(from, end);
}

/**
 * Where the most watched snippet-long stretch begins.
 *
 * @param markers - the graph's bars, in time order
 * @param duration - the video's length in seconds
 * @returns the start second, or null without a graph
 */
function peakStart(
  markers: readonly HeatMarker[],
  duration: number,
): number | null {
  const skip = Math.max(SKIP_MIN_SECONDS, duration * SKIP_SHARE) * MS;
  const latest = (duration - SNIPPET_SECONDS) * MS;
  const window = SNIPPET_SECONDS * MS;
  const bars = markers.map((marker) => ({
    start: Number(marker.startMillis),
    intensity: marker.intensityScoreNormalized,
  }));

  let best: number | null = null;
  let bestSum = -1;
  for (const bar of bars) {
    if (bar.start >= skip && bar.start <= latest) {
      const sum = bars
        .filter(
          (other) =>
            other.start >= bar.start && other.start < bar.start + window,
        )
        .reduce((total, other) => total + other.intensity, 0);
      if (sum > bestSum) {
        best = bar.start;
        bestSum = sum;
      }
    }
  }
  return best === null ? null : Math.round(best / MS);
}

/** Finds the "most replayed" graph in a watch page's data. */
function heatMarkers(node: unknown): readonly HeatMarker[] {
  let found: readonly HeatMarker[] = [];
  if (typeof node === "object" && node !== null) {
    const list = node as { markerType?: string; markers?: HeatMarker[] };
    if (list.markerType === "MARKER_TYPE_HEATMAP" && list.markers) {
      found = list.markers;
    } else {
      for (const child of Object.values(node)) {
        if (found.length === 0) {
          found = heatMarkers(child);
        }
      }
    }
  }
  return found;
}
