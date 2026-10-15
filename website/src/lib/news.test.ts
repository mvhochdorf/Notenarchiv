/**
 * Tests for the inbox.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import { newsItems, validNews } from "./news";
import { TEST_SONGS } from "./test-songs";

describe("inbox", () => {
  const [a, b] = TEST_SONGS;
  const sources = {
    songs: TEST_SONGS,
    news: validNews({
      [a.id]: { anna: { like: 3000, rating: 2000 }, me: { like: 9000 } },
      [b.id]: { ben: { added: 1000, junk: "x" }, carl: { rating: 5000 } },
      gone: { anna: { like: 8000 } },
    }),
    comments: {
      [b.id]: { c1: { person: "dora", name: "Dora", text: "Toll!", at: 4000 } },
    },
    votes: { [a.id]: { anna: 4 } },
    people: { anna: "Anna Muster", ben: "Ben Beispiel" },
    me: "me",
  };

  it("lists what the others did, newest first", () => {
    expect(newsItems(sources).map((item) => [item.kind, item.name])).toEqual([
      ["comment", "Dora"],
      ["like", "Anna Muster"],
      ["rating", "Anna Muster"],
      ["added", "Ben Beispiel"],
    ]);
  });

  it("carries the stars and leaves out taken back ratings", () => {
    const rating = newsItems(sources).find((item) => item.kind === "rating");
    expect(rating?.stars).toBe(4);
    // Carl's note has no vote behind it any more.
    expect(newsItems(sources).some((item) => item.name === "Jemand")).toBe(
      false,
    );
  });
});
