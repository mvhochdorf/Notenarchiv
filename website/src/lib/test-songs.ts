/**
 * A few pieces for the tests, shaped like a real archive.
 *
 * @module
 */
import type { Song } from "./song";

/** A piece with only the fields a test cares about. */
function piece(fields: Partial<Song> & Pick<Song, "id" | "title">): Song {
  return {
    number: null,
    genre: null,
    occasion: null,
    solo: null,
    composer: null,
    arranger: null,
    publisher: null,
    folderNumber: null,
    collection: null,
    ...fields,
  };
}

/** Pieces of several categories, a hidden chorale among them. */
export const TEST_SONGS: readonly Song[] = [
  piece({
    id: "99-alte-kameraden",
    number: "99",
    title: "Alte Kameraden",
    genre: "Märsche",
    composer: "Carl Teike",
  }),
  piece({
    id: "277a-boehmischer-traum",
    number: "277a",
    title: "Böhmischer Traum",
    genre: "Polka",
    composer: "Norbert Gälle",
  }),
  piece({
    id: "1001-a-banda",
    number: "1001",
    title: "A Banda",
    genre: "Konzert",
    composer: "Franz Löffler",
    added: "2026-10-01",
  }),
  piece({
    id: "12-radetzky-marsch",
    number: "12",
    title: "Radetzky-Marsch",
    genre: "Märsche",
    composer: "Johann Strauss",
  }),
  piece({
    id: "500-grosser-gott-wir-loben-dich",
    number: "500",
    title: "Großer Gott, wir loben Dich",
    genre: "Choral",
    occasion: "Kirche",
  }),
  piece({ id: "ohne-nummer", title: "Ohne Nummer", genre: "Unterhaltung" }),
];
