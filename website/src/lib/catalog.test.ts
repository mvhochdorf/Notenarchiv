/**
 * Tests for the catalog: the start set, the database round trip and new
 * pieces.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import {
  catalogEntries,
  catalogOf,
  MAX_FIELD_LENGTH,
  newSongId,
  startCatalog,
} from "./catalog";
import { TEST_SONGS } from "./test-songs";

/** A start set as the scripts put it together. */
const START = startCatalog(
  TEST_SONGS,
  {
    "99-alte-kameraden": {
      videoId: "dQw4w9WgXcQ",
      start: 0,
      duration: 200,
      peak: 80,
      label: "Alte Kameraden | Blasorchester",
    },
    "277a-boehmischer-traum": { videoId: "dQw4w9WgXcQ", start: 5, peak: null },
    "1001-a-banda": { label: "nicht gefunden" },
    "12-radetzky-marsch": { label: "kein Video (vom Verein eingetragen)" },
  },
  { "99-alte-kameraden": "2026-01-02" },
);

describe("catalog", () => {
  it("puts the start set together", () => {
    expect(START.songs).toHaveLength(TEST_SONGS.length);
    expect(Object.keys(START.videos).sort()).toEqual([
      "277a-boehmischer-traum",
      "99-alte-kameraden",
    ]);
    expect([...START.noVideo]).toEqual(["12-radetzky-marsch"]);
    expect(
      START.songs.find((song) => song.id === "99-alte-kameraden")?.added,
    ).toBe("2026-01-02");
  });

  it("comes back unchanged from the database", () => {
    // What the database hands back: JSON, without undefined or null.
    const stored = JSON.parse(JSON.stringify(catalogEntries(START))) as unknown;
    const read = catalogOf(stored);
    expect(read?.songs.map((song) => song.id)).toEqual(
      START.songs.map((song) => song.id),
    );
    expect(read?.noVideo).toEqual(START.noVideo);
    expect(read?.videos["99-alte-kameraden"]).toEqual(
      START.videos["99-alte-kameraden"],
    );
    expect(read?.videos["277a-boehmischer-traum"]?.peak).toBeUndefined();
  });

  it("fits the database rules", () => {
    for (const entry of Object.values(catalogEntries(START))) {
      for (const value of Object.values(entry)) {
        if (typeof value === "string") {
          expect(value.length).toBeGreaterThan(0);
          expect(value.length).toBeLessThanOrEqual(MAX_FIELD_LENGTH);
        }
      }
      expect(entry.added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("is empty until pieces are added", () => {
    expect(catalogOf(null)).toBeNull();
    expect(catalogOf({ broken: { number: "1" } })).toBeNull();
  });

  it("gives a new piece an id of its own", () => {
    const taken = new Set(["12-polka", "12-polka-2"]);
    expect(newSongId("12", "Polka", taken)).toBe("12-polka-3");
    expect(newSongId(null, "Neuer Marsch", taken)).toBe("neuer-marsch");
  });
});
