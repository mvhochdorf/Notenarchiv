/**
 * Tests for ids, ratings, YouTube links and list ordering.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import {
  filterSongs,
  NO_FILTER,
  popularity,
  sortSongs,
  visibleSongs,
} from "./library";
import { parseYouTube, snippetStart } from "./media";
import { summarize } from "./ratings";
import {
  commentsOf,
  isComment,
  markCount,
  timeAgo,
  validComments,
} from "./social";
import { songId, uniqueIds } from "./song";
import { TEST_SONGS } from "./test-songs";

/** Every test piece, hidden ones included. */
const ALL_SONGS = TEST_SONGS;

/** The pieces the app shows. */
const SONGS = visibleSongs(ALL_SONGS);

describe("songId", () => {
  it("combines number and title into a safe slug", () => {
    expect(songId("1553a", "Aber Dich gibt´s nur einmal für mich")).toBe(
      "1553a-aber-dich-gibt-s-nur-einmal-fuer-mich",
    );
    expect(songId(null, "Großer Gott, wir loben Dich")).toBe(
      "grosser-gott-wir-loben-dich",
    );
  });

  it("numbers repeated ids", () => {
    expect(uniqueIds(["a", "b", "a", "a"])).toEqual(["a", "b", "a-2", "a-3"]);
  });
});

describe("summarize", () => {
  it("averages valid votes and ignores junk", () => {
    const summary = summarize({ x: { a: 5, b: 3, c: 9, d: "4" as never } });
    expect(summary.get("x")?.average).toBe(4);
    expect(summary.get("x")?.count).toBe(2);
  });

  it("counts zero stars as a vote", () => {
    const summary = summarize({ x: { a: 0, b: 5 } });
    expect(summary.get("x")?.average).toBe(2.5);
    expect(summary.get("x")?.count).toBe(2);
  });

  it("ranks many good votes above a single perfect one", () => {
    const summary = summarize({
      lonely: { a: 5 },
      loved: { a: 5, b: 5, c: 4, d: 5, e: 5, f: 4 },
      meh: { a: 2, b: 2 },
    });
    expect(summary.get("loved")!.score).toBeGreaterThan(
      summary.get("lonely")!.score,
    );
  });
});

describe("parseYouTube", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", 0],
    ["youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s", 90],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", 42],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", 0],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=7", 7],
    ["dQw4w9WgXcQ", 0],
  ])("reads %s", (input, start) => {
    expect(parseYouTube(input)).toEqual({ videoId: "dQw4w9WgXcQ", start });
  });

  it("rejects other links", () => {
    expect(parseYouTube("https://vimeo.com/123")).toBeNull();
    expect(parseYouTube("hallo")).toBeNull();
  });
});

describe("snippetStart", () => {
  const video = { videoId: "dQw4w9WgXcQ", start: 0, duration: 245 };

  it("starts in the middle, leaving room for the snippet", () => {
    expect(snippetStart(video, "middle", 0)).toBe(100);
  });

  it("starts at the peak, or in the middle without one", () => {
    expect(snippetStart({ ...video, peak: 118 }, "peak", 0)).toBe(118);
    expect(snippetStart({ ...video, peak: null }, "peak", 0)).toBe(100);
  });

  it("keeps random starts past the intro and before the end", () => {
    expect(snippetStart(video, "random", 0)).toBe(25);
    expect(snippetStart(video, "random", 0.999)).toBeLessThanOrEqual(200);
  });

  it("uses the entered start when the length is unknown", () => {
    const linked = { videoId: "dQw4w9WgXcQ", start: 30 };
    expect(snippetStart(linked, "middle", 0.5)).toBe(30);
    expect(snippetStart(linked, "random", 0.5)).toBe(30);
  });
});

describe("hidden categories", () => {
  it("leaves chorales out of the app but keeps them in the data", () => {
    expect(ALL_SONGS.some((song) => song.genre === "Choral")).toBe(true);
    expect(SONGS.some((song) => song.genre === "Choral")).toBe(false);
    expect(SONGS.length).toBeLessThan(ALL_SONGS.length);
  });
});

describe("filter and sort", () => {
  const context = { summaries: new Map(), mine: {}, seed: 0.5 };

  it("finds pieces by title words in any order", () => {
    const found = filterSongs(ALL_SONGS, {
      ...NO_FILTER,
      query: "gott grosser",
    });
    expect(found.some((song) => song.title.startsWith("Großer Gott"))).toBe(
      true,
    );
  });

  it("filters by category", () => {
    const marches = filterSongs(SONGS, { ...NO_FILTER, genre: "Märsche" });
    expect(marches.length).toBeGreaterThan(0);
    expect(marches.every((song) => song.genre === "Märsche")).toBe(true);
  });

  it("shuffles the same way for the same seed", () => {
    const first = sortSongs(SONGS, "random", context);
    const second = sortSongs(SONGS, "random", context);
    expect(first).toEqual(second);
    expect(first).not.toEqual(SONGS);
  });

  it("orders archive numbers numerically", () => {
    const numbers = sortSongs(SONGS, "number", context)
      .map((song) => song.number)
      .filter((number) => number !== null)
      .map((number) => parseInt(number, 10));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it("mixes stars and hearts into popularity", () => {
    const [a, b, c] = SONGS;
    const votes: Record<string, Record<string, number>> = {
      [a.id]: { x: 5, y: 5 },
      [b.id]: { x: 1 },
    };
    const summaries = summarize(votes);
    // two 5-star votes = +4, three hearts = +3, one 1-star vote = -2
    expect(popularity(summaries.get(a.id)!, 0)).toBe(4);
    expect(popularity(summaries.get(b.id)!, 0)).toBe(-2);
    const likes = {
      [c.id]: { x: true as const, y: true as const, z: true as const },
    };
    const sorted = sortSongs([b, c, a], "popular", {
      ...context,
      summaries,
      likes,
    });
    expect(sorted.map((song) => song.id)).toEqual([a.id, c.id, b.id]);
  });

  it("leaves out what I already rated", () => {
    const unrated = sortSongs(SONGS, "unrated", {
      ...context,
      mine: { [SONGS[0].id]: 4 },
    });
    expect(unrated).toHaveLength(SONGS.length - 1);
  });
});

describe("social", () => {
  const comment = {
    person: "anna-muster",
    name: "Anna",
    text: "Schön!",
    at: 2000,
  };

  it("keeps valid comments only, oldest first", () => {
    const all = validComments({
      song: {
        b: comment,
        a: { ...comment, at: 1000 },
        empty: { ...comment, text: "  " },
        long: { ...comment, text: "x".repeat(501) },
        junk: 42,
      },
    });
    expect(commentsOf(all, "song").map((c) => c.id)).toEqual(["a", "b"]);
    expect(isComment({ ...comment, at: "now" })).toBe(false);
  });

  it("counts marks", () => {
    expect(markCount({ song: { a: true, b: true } }, "song")).toBe(2);
    expect(markCount({}, "song")).toBe(0);
  });

  it("says how long ago", () => {
    const now = Date.UTC(2026, 9, 13, 12);
    expect(timeAgo(now - 5_000, now)).toBe("gerade eben");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("vor 5 Min.");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("vor 3 Std.");
    expect(timeAgo(now - 86_400_000, now)).toBe("gestern");
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe("vor 3 Tagen");
  });
});
