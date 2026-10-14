/**
 * Tests for the three feeds.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import { summarize } from "./ratings";
import { rankForYou, rankNew, rankTrend, type Signals } from "./recommend";
import type { Song } from "./song";

/** A piece with only the fields the ranking looks at. */
function song(id: string, genre: string, composer: string | null = null): Song {
  return {
    id,
    number: null,
    title: id,
    genre,
    occasion: null,
    solo: null,
    composer,
    arranger: null,
    publisher: null,
    folderNumber: null,
    collection: null,
  };
}

const SONGS = [
  song("march1", "Märsche", "Teike"),
  song("march2", "Märsche", "Teike"),
  song("polka1", "Polka"),
  song("choral1", "Choral"),
  song("choral2", "Choral"),
];

/** Signals with nothing done, plus what a test adds. */
function signals(change: Partial<Signals>): Signals {
  const votes = change.votes ?? {};
  return {
    votes,
    summaries: summarize(votes),
    likes: {},
    saved: {},
    views: {},
    comments: {},
    me: "me",
    ...change,
  };
}

const ids = (songs: readonly Song[]) => songs.map((piece) => piece.id);

describe("stages", () => {
  const seenSome = signals({
    views: { march1: { me: true }, choral1: { me: true } },
    likes: { march2: { me: true } },
    votes: { polka1: { me: 4 } },
  });

  it("puts unseen first, then seen but untouched, then liked or rated", () => {
    for (const rank of [rankNew, rankForYou, rankTrend]) {
      const order = ids(rank(SONGS, seenSome, 0.3));
      expect(order[0]).toBe("choral2");
      expect(new Set(order.slice(1, 3))).toEqual(
        new Set(["march1", "choral1"]),
      );
      expect(new Set(order.slice(3))).toEqual(new Set(["march2", "polka1"]));
    }
  });

  it("ends with what I liked or rated best", () => {
    const ranked = rankTrend(
      SONGS,
      signals({
        votes: { march1: { me: 1 }, march2: { me: 5 }, polka1: { me: 3 } },
      }),
      0.3,
    );
    expect(ids(ranked).slice(-3)).toEqual(["march2", "polka1", "march1"]);
  });

  it("never lets a popular seen piece jump ahead of an unseen one", () => {
    const ranked = rankTrend(
      SONGS,
      signals({
        views: { march1: { me: true } },
        likes: { march1: { a: true, b: true, c: true } },
      }),
      0.3,
    );
    expect(ids(ranked).at(-1)).toBe("march1");
  });
});

describe("rankNew", () => {
  it("puts the newest pieces first", () => {
    const numbered = [
      { ...song("old", "Märsche"), number: "100" },
      { ...song("newest", "Märsche"), number: "300" },
      { ...song("newer", "Märsche"), number: "200a" },
    ];
    expect(ids(rankNew(numbered, signals({}), 0.3))).toEqual([
      "newest",
      "newer",
      "old",
    ]);
  });
});

describe("rankForYou", () => {
  it("prefers pieces like the ones I liked", () => {
    const ranked = rankForYou(
      SONGS,
      signals({ likes: { march1: { me: true } } }),
      0.3,
    );
    expect(ranked[0].id).toBe("march2");
  });

  it("suggests what people with my taste liked", () => {
    const ranked = rankForYou(
      SONGS,
      signals({
        likes: {
          polka1: { me: true, anna: true },
          choral2: { anna: true },
          choral1: { bob: true },
        },
      }),
      0.3,
    );
    expect(ids(ranked).indexOf("choral2")).toBeLessThan(
      ids(ranked).indexOf("choral1"),
    );
  });

  it("puts pieces I rated last", () => {
    const ranked = rankForYou(
      SONGS,
      signals({ votes: { march2: { me: 5 } } }),
      0.3,
    );
    expect(ranked.at(-1)?.id).toBe("march2");
  });

  it("returns every piece", () => {
    expect(rankForYou(SONGS, signals({}), 0.7)).toHaveLength(SONGS.length);
  });
});

describe("rankTrend", () => {
  it("orders by approval of everybody", () => {
    const ranked = rankTrend(
      SONGS,
      signals({
        likes: { polka1: { a: true, b: true }, choral1: { a: true } },
        votes: { choral2: { a: 5, b: 5, c: 5 } },
      }),
      0.3,
    );
    expect(ids(ranked).slice(0, 3)).toEqual(["choral2", "polka1", "choral1"]);
  });
});
