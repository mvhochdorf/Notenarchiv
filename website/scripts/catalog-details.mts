/**
 * Adds length and most watched part to the catalog's videos in the database.
 *
 * @module
 * @remarks
 * A video the admin links on the admin page only has its id and start: the
 * browser may not read YouTube's pages, so it cannot find the "most
 * replayed" part itself. This script can. It signs in with the shared admin
 * account, loads the watch page of every catalog video without a length and
 * stores
 *
 * - `duration`: the length in seconds
 * - `peak`: where the most watched snippet-long stretch begins - left out
 *   when YouTube shows no graph (videos with few views); the snippet then
 *   starts in the middle
 *
 * Runs every night as a GitHub workflow (.github/workflows/video-details.yml)
 * and by hand with `npm run catalog:details`. The password comes from the
 * environment variable `ADMIN_PASSWORD`, or is asked for. `--limit=20` stops
 * after twenty videos.
 */
import { deleteApp, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  get,
  getDatabase,
  ref,
  runTransaction,
  type Database,
} from "firebase/database";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import type { StoredVideo } from "../src/lib/catalog";
import { CLUB } from "../src/lib/club";
import { FIREBASE_CONFIG } from "../src/lib/firebase-config";
import { describeVideo, PAUSE_MS, sleep } from "./youtube-page.mjs";

/** Where the catalog lives in the database. */
const CATALOG = "notenarchiv/catalog";

/** Exit code when nothing could be read - YouTube blocking, most likely. */
const FAILED = 1;

const limit = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ??
    Number.POSITIVE_INFINITY,
);

const app = initializeApp(FIREBASE_CONFIG);
process.exitCode = await run();
// Closes the connection, so the script ends by itself.
await deleteApp(app);

/** Runs the script and turns a failed sign-in into a plain message. */
async function run(): Promise<number> {
  let code = FAILED;
  try {
    code = await main();
  } catch (error) {
    const reason = (error as { code?: string }).code ?? String(error);
    console.error(
      `Abgebrochen (${reason}) - stimmt das Verwaltungs-Passwort, und ist das Konto eingerichtet (docs/verwaltung.md)?`,
    );
  }
  return code;
}

/**
 * Describes every catalog video that still needs it.
 *
 * @returns the exit code
 */
async function main(): Promise<number> {
  await signInWithEmailAndPassword(
    getAuth(app),
    CLUB.admin.email,
    await password(),
  );
  const db = getDatabase(app);
  const catalog = ((await get(ref(db, CATALOG))).val() ?? {}) as Record<
    string,
    { readonly video?: StoredVideo }
  >;
  const todo = Object.entries(catalog)
    .filter(([, entry]) => entry.video && entry.video.duration === undefined)
    .slice(0, limit);
  console.log(`${todo.length} Videos ohne Länge und Höhepunkt.`);

  let described = 0;
  for (const [index, [songId, entry]] of todo.entries()) {
    const videoId = entry.video?.videoId ?? "";
    const details = await describeVideo(videoId);
    const step = `[${index + 1}/${todo.length}] ${songId}`;
    if (details === null) {
      console.log(`${step}: nicht lesbar`);
    } else {
      await store(db, songId, videoId, details.duration, details.peak);
      described += 1;
      console.log(
        `${step}: ${details.duration}s, Höhepunkt ${details.peak ?? "-"}`,
      );
    }
    await sleep(PAUSE_MS);
  }

  console.log(`Fertig: ${described} von ${todo.length} ergänzt.`);
  return todo.length > 0 && described === 0 ? FAILED : 0;
}

/**
 * Writes length and peak to a piece's video.
 *
 * @remarks
 * Only while the piece still has that video - the admin may have changed it
 * in the meantime.
 */
async function store(
  db: Database,
  songId: string,
  videoId: string,
  duration: number,
  peak: number | null,
): Promise<void> {
  await runTransaction(
    ref(db, `${CATALOG}/${songId}/video`),
    (current: StoredVideo | null) =>
      current?.videoId === videoId
        ? { ...current, duration, ...(peak === null ? {} : { peak }) }
        : undefined,
  );
}

/** The admin password, from the environment or asked for. */
async function password(): Promise<string> {
  let given = process.env.ADMIN_PASSWORD ?? "";
  if (given === "") {
    const prompt = createInterface({ input: stdin, output: stdout });
    given = await prompt.question("Verwaltungs-Passwort: ");
    prompt.close();
  }
  return given;
}
