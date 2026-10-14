/**
 * Turns Notenliste.xlsx into the song list the website ships with.
 *
 * @module
 * @remarks
 * The spreadsheet stays the single source of truth and is only read, never
 * written. Run `npm run import` after editing it; the result goes to
 * `src/data/songs.json` and is committed, so the site builds without Excel.
 */
import ExcelJS from "exceljs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { songId, uniqueIds, type Song } from "../src/lib/song";

/** Where the archive list lives (repository root). */
const SOURCE = fileURLToPath(new URL("../../Notenliste.xlsx", import.meta.url));

/** Where the website reads it from. */
const TARGET = fileURLToPath(
  new URL("../src/data/songs.json", import.meta.url),
);

/** When each piece first appeared, for the "new" feed. */
const ADDED = fileURLToPath(new URL("../src/data/added.json", import.meta.url));

/** Spreadsheet header for each song field. */
const COLUMNS = {
  number: "Neue Nr.",
  title: "Titel",
  genre: "Sparte",
  occasion: "Anlass",
  solo: "Solo",
  composer: "Komponist",
  arranger: "Bearbeitung",
  publisher: "Verlag",
  folderNumber: "Nr. im Ordner",
  collection: "Sammlung/Heft",
} as const;

type Field = keyof typeof COLUMNS;

/** Spaces in JSON output. */
const JSON_INDENT = 2;

await main();

/** Reads the first sheet and writes the JSON file. */
async function main(): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(SOURCE);
  const sheet = workbook.worksheets[0];

  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    headers.set(text(cell.value) ?? "", column);
  });

  const rows: Omit<Song, "id">[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const cell = (field: Field) =>
        text(row.getCell(headers.get(COLUMNS[field]) ?? 0).value);
      const title = cell("title");
      if (title !== null) {
        rows.push({
          number: cell("number"),
          title,
          genre: cell("genre"),
          occasion: cell("occasion"),
          solo: cell("solo"),
          composer: cell("composer"),
          arranger: cell("arranger"),
          publisher: cell("publisher"),
          folderNumber: cell("folderNumber"),
          collection: cell("collection"),
        });
      }
    }
  });

  const ids = uniqueIds(rows.map((row) => songId(row.number, row.title)));
  const songs: Song[] = rows.map((row, index) => ({ id: ids[index], ...row }));
  writeFileSync(TARGET, `${JSON.stringify(songs, null, JSON_INDENT)}\n`);
  console.log(`${songs.length} Stücke nach ${TARGET} geschrieben.`);
  noteAdded(songs);
}

/**
 * Notes the day each piece first showed up in the spreadsheet.
 *
 * @remarks
 * The "new" feed puts the newest pieces first. Pieces already noted keep
 * their day; only pieces imported for the first time get today's.
 */
function noteAdded(songs: readonly Song[]): void {
  const added = existsSync(ADDED)
    ? (JSON.parse(readFileSync(ADDED, "utf8")) as Record<string, string>)
    : {};
  const today = new Date().toISOString().slice(0, "YYYY-MM-DD".length);
  let fresh = 0;
  for (const song of songs) {
    if (added[song.id] === undefined) {
      added[song.id] = today;
      fresh += 1;
    }
  }
  const sorted = Object.fromEntries(
    Object.entries(added).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(ADDED, `${JSON.stringify(sorted, null, JSON_INDENT)}\n`);
  console.log(`${fresh} Stücke neu im Archiv.`);
}

/** A cell value as trimmed text, or null when empty. */
function text(value: ExcelJS.CellValue): string | null {
  let raw = "";
  if (value === null || value === undefined) {
    raw = "";
  } else if (typeof value === "object" && "richText" in value) {
    raw = value.richText.map((part) => part.text).join("");
  } else if (typeof value === "object" && "result" in value) {
    raw = String(value.result ?? "");
  } else {
    raw = String(value);
  }
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed === "" || trimmed === "?" ? null : trimmed;
}
