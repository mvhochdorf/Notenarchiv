/**
 * Tests for person ids and the evaluation.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import { commentRows, personRows, songRows, toCsv } from "./evaluation";
import { TEST_SONGS } from "./test-songs";
import { personId } from "./person";
import { summarize } from "./ratings";

describe("personId", () => {
  it("is the same however the name is typed", () => {
    expect(personId(" Jürgen ", "Groß")).toBe("juergen-gross");
    expect(personId("jürgen", "GROSS")).toBe("juergen-gross");
  });

  it("needs both parts", () => {
    expect(personId("Max", " ")).toBe("");
  });
});

describe("evaluation", () => {
  const song = TEST_SONGS[0];
  const votes = { [song.id]: { anna: 5, ben: 3 } };
  const data = {
    votes,
    summaries: summarize(votes),
    likes: { [song.id]: { anna: true as const } },
    saved: {},
    views: { [song.id]: { anna: true as const, ben: true as const } },
    comments: {
      [song.id]: {
        c1: { person: "ben", name: "Ben B", text: "Gut", at: 1000 },
      },
    },
    people: { anna: "Anna A", ben: "Ben B", carl: "Carl C" },
  };

  it("counts per piece", () => {
    const row = songRows([song], data)[0];
    expect(row).toMatchObject({
      average: 4,
      votes: 2,
      likes: 1,
      comments: 1,
      views: 2,
    });
  });

  it("counts per person, most active first, registered ones included", () => {
    const rows = personRows(data);
    expect(rows.map((row) => row.name)).toEqual(["Anna A", "Ben B", "Carl C"]);
    expect(rows[1]).toMatchObject({ votes: 1, comments: 1, views: 1 });
  });

  it("lists comments with their piece", () => {
    expect(commentRows(TEST_SONGS, data)[0]).toMatchObject({
      song,
      name: "Ben B",
      text: "Gut",
    });
  });

  it("writes CSV for a German Excel", () => {
    expect(toCsv(["A", "B"], [["x;y", 'sag "hi"']])).toBe(
      '﻿A;B\r\n"x;y";"sag ""hi"""\r\n',
    );
  });
});
