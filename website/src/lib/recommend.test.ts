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

describe("rankNew", () => {
  it("puts unseen first, then seen without like or stars, then unrated", () => {
    const ranked = rankNew(
      SONGS,
      signals({
        views: {
          march1: { me: true },
          march2: { me: true },
          polka1: { me: true },
          choral1: { me: true },
        },
        likes: { march2: { me: true } },
        votes: { polka1: { me: 4 } },
      }),
      0.3,
    );
    expect(ids(ranked)).toEqual([
      "choral2",
      "choral1",
      "march1",
      "march2",
      "polka1",
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
