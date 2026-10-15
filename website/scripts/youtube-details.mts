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
import type { FixedMedia } from "../src/lib/media";
import { describeVideo, PAUSE_MS, sleep } from "./youtube-page.mjs";

/** The fixed links. */
const TARGET = fileURLToPath(
  new URL("../verein/youtube.json", import.meta.url),
);

/** Spaces in JSON output. */
const JSON_INDENT = 2;

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
    const details = await describeVideo(entry.videoId ?? "");
    if (details !== null) {
      const { duration, peak } = details;
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

/** Writes the file back, keeping its order. */
function save(): void {
  writeFileSync(TARGET, `${JSON.stringify(links, null, JSON_INDENT)}\n`);
}
