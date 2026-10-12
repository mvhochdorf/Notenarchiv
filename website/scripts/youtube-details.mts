/**
 * Adds length and most watched part to every fixed link in youtube.json.
 *
 * @module
 * @remarks
 * Run with `npm run youtube:details`, after `npm run youtube`. Loads the
 * watch page of every linked video that has not been described yet and
 * stores
 *
 * - `duration`: the length in seconds, so the app can start a snippet in the
 *   middle or at a random place
 * - `peak`: where the most watched stretch of a snippet's length begins,
 *   from YouTube's "most replayed" graph - mostly the best part of the piece,
 *   past announcements and applause. `null` when YouTube shows no graph
 *   (videos with few views).
 *
 * Entries that already have both are skipped, so the script can be stopped
 * and resumed. `--limit=20` stops after twenty videos.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SNIPPET_SECONDS, type FixedMedia } from "../src/lib/media";
import { loadPage, PAUSE_MS, pageData, sleep } from "./youtube-page.mjs";

/** The fixed links. */
const TARGET = fileURLToPath(
  new URL("../src/data/youtube.json", import.meta.url),
);

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

/** Spaces in JSON output. */
const JSON_INDENT = 2;

/** One bar of the "most replayed" graph. */
type HeatMarker = {
  readonly startMillis: string;
  readonly durationMillis: string;
  readonly intensityScoreNormalized: number;
};

const links = JSON.parse(readFileSync(TARGET, "utf8")) as Record<
  string,
  Partial<FixedMedia>
>;
const limit = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
    Number.POSITIVE_INFINITY,
);

await main();

/** Describes every link that still needs it. */
async function main(): Promise<void> {
  const todo = Object.entries(links)
    .filter(
      ([, entry]) =>
        entry.videoId !== undefined &&
        (entry.duration === undefined || entry.peak === undefined),
    )
    .slice(0, limit);
  console.log(`${todo.length} Videos werden ausgewertet.`);

  for (const [index, [songId, entry]] of todo.entries()) {
    const html = await loadPage(
      `https://www.youtube.com/watch?v=${entry.videoId}&hl=de`,
    );
    const length = Number(/"lengthSeconds":"(\d+)"/.exec(html)?.[1] ?? NaN);
    if (Number.isFinite(length) && length > 0) {
      const duration = length;
      const peak = peakStart(
        heatMarkers(pageData(html, "ytInitialData")),
        duration,
      );
      links[songId] = { ...entry, duration, peak };
      console.log(
        `[${index + 1}/${todo.length}] ${songId}: ${duration}s, Höhepunkt ${peak ?? "-"}`,
      );
      save();
    } else {
      console.log(`[${index + 1}/${todo.length}] ${songId}: nicht lesbar`);
    }
    await sleep(PAUSE_MS);
  }
  console.log("Fertig.");
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

/** Writes the file back, keeping its order. */
function save(): void {
  writeFileSync(TARGET, `${JSON.stringify(links, null, JSON_INDENT)}\n`);
}
