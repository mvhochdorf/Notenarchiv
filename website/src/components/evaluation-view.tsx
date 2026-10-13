/**
 * The evaluation page: what all musicians rated, liked and wrote.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import { useArchive } from "@/lib/archive-store";
import {
  commentRows,
  personRows,
  songRows,
  toCsv,
  type SongRow,
} from "@/lib/evaluation";
import { SONGS } from "@/lib/library";
import { ModeNotice } from "./mode-notice";

/** The three tables. */
type Table = "songs" | "people" | "comments" | "reports";

/** Labels of the tables. */
const TABLES: Readonly<Record<Table, string>> = {
  songs: "Stücke",
  people: "Personen",
  comments: "Kommentare",
  reports: "Meldungen",
};

/** The columns the piece table can be sorted by, and their titles. */
const SONG_COLUMNS = {
  average: "Ø Sterne",
  votes: "Stimmen",
  likes: "Likes",
  saves: "Gemerkt",
  comments: "Kommentare",
  views: "Gesehen",
} as const;

type SongColumn = keyof typeof SONG_COLUMNS;

/** Digits of an average. */
const AVERAGE_DIGITS = 1;

/**
 * Renders the evaluation.
 *
 * @returns the page content
 * @remarks
 * Reads the same live data as the feed, so it is up to date while it is
 * open. Each table can be saved as a CSV file for Excel.
 */
export function EvaluationView(): ReactElement {
  const archive = useArchive();
  const [table, setTable] = useState<Table>("songs");
  const [sortBy, setSortBy] = useState<SongColumn>("average");
  const [onlyActive, setOnlyActive] = useState(true);

  const songs = songRows(SONGS, archive)
    .filter((row) => !onlyActive || activity(row) > 0)
    .sort(
      (a, b) =>
        b[sortBy] - a[sortBy] ||
        b.votes - a.votes ||
        a.song.title.localeCompare(b.song.title, "de"),
    );
  const people = personRows(archive);
  const comments = commentRows(SONGS, archive);
  // Reports are stored like comments, so the same rows serve both.
  const reports = commentRows(SONGS, { ...archive, comments: archive.reports });
  const notes = table === "reports" ? reports : comments;

  const download = () => {
    const [name, csv] = exportOf(table, songs, people, notes);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const tabClass = (selected: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold ${
      selected ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"
    }`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-black tracking-tight">
          📊 Auswertung
        </h1>
        <ModeNotice mode={archive.mode} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TABLES) as Table[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTable(key)}
            className={tabClass(table === key)}
          >
            {TABLES[key]}
          </button>
        ))}
        <button
          type="button"
          onClick={download}
          className="ml-auto rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20"
        >
          ⬇ Als Excel-Datei (CSV)
        </button>
      </div>

      {table === "songs" && (
        <>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={() => setOnlyActive(!onlyActive)}
              className="accent-amber-400"
            />
            Nur Stücke mit Bewertung, Like, Merken, Kommentar oder Aufruf
          </label>
          <div className="overflow-x-auto rounded-2xl bg-white/5">
            <table className="w-full text-sm">
              <thead className="text-left text-white/60">
                <tr>
                  <th className="min-w-48 p-3">Stück</th>
                  {(Object.keys(SONG_COLUMNS) as SongColumn[]).map((key) => (
                    <th key={key} className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSortBy(key)}
                        className={
                          sortBy === key ? "text-amber-400" : "hover:text-white"
                        }
                      >
                        {SONG_COLUMNS[key]}
                        {sortBy === key ? " ▼" : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {songs.map((row) => (
                  <tr key={row.song.id}>
                    <td className="p-3">
                      <span className="font-semibold">{row.song.title}</span>
                      <span className="block text-xs text-white/50">
                        {[
                          row.song.number && `Nr. ${row.song.number}`,
                          row.song.genre,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {row.votes === 0 ? "-" : decimal(row.average)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.votes}</td>
                    <td className="p-3 text-right tabular-nums">{row.likes}</td>
                    <td className="p-3 text-right tabular-nums">{row.saves}</td>
                    <td className="p-3 text-right tabular-nums">
                      {row.comments}
                    </td>
                    <td className="p-3 text-right tabular-nums">{row.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {songs.length === 0 && (
              <p className="p-6 text-center text-white/50">Noch keine Daten.</p>
            )}
          </div>
        </>
      )}

      {table === "people" && (
        <div className="overflow-x-auto rounded-2xl bg-white/5">
          <table className="w-full text-sm">
            <thead className="text-left text-white/60">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3 text-right">Bewertet</th>
                <th className="p-3 text-right">Likes</th>
                <th className="p-3 text-right">Gemerkt</th>
                <th className="p-3 text-right">Kommentare</th>
                <th className="p-3 text-right">Gesehen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {people.map((row) => (
                <tr key={row.id}>
                  <td className="p-3 font-semibold">{row.name}</td>
                  <td className="p-3 text-right tabular-nums">{row.votes}</td>
                  <td className="p-3 text-right tabular-nums">{row.likes}</td>
                  <td className="p-3 text-right tabular-nums">{row.saves}</td>
                  <td className="p-3 text-right tabular-nums">
                    {row.comments}
                  </td>
                  <td className="p-3 text-right tabular-nums">{row.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(table === "comments" || table === "reports") && (
        <ul className="space-y-2">
          {table === "reports" && (
            <li className="text-sm text-white/60">
              Meldungen zu Fehlern bei Stücken (falsches Video, falscher Titel
              ...). Zum Beheben die CSV-Datei herunterladen und weitergeben;
              erledigte Meldungen in der Firebase-Konsole unter
              notenarchiv/reports löschen.
            </li>
          )}
          {notes.length === 0 && (
            <li className="rounded-2xl bg-white/5 p-6 text-center text-white/50">
              {table === "reports"
                ? "Keine Meldungen."
                : "Noch keine Kommentare."}
            </li>
          )}
          {notes.map((row) => (
            <li
              key={`${row.song.id}-${row.at}`}
              className="rounded-2xl bg-white/5 p-3"
            >
              <p className="text-xs text-white/50">
                <span className="font-semibold text-white/80">{row.name}</span>{" "}
                zu <span className="text-amber-300">{row.song.title}</span> ·{" "}
                {dateTime(row.at)}
              </p>
              <p className="text-sm whitespace-pre-wrap">{row.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Whether anybody did anything with a piece. */
function activity(row: SongRow): number {
  return row.votes + row.likes + row.saves + row.comments + row.views;
}

/** The file name and content of a table's export. */
function exportOf(
  table: Table,
  songs: readonly SongRow[],
  people: ReturnType<typeof personRows>,
  notes: ReturnType<typeof commentRows>,
): [string, string] {
  let result: [string, string];
  switch (table) {
    case "people":
      result = [
        "notenarchiv-personen.csv",
        toCsv(
          ["Name", "Bewertet", "Likes", "Gemerkt", "Kommentare", "Gesehen"],
          people.map((row) => [
            row.name,
            row.votes,
            row.likes,
            row.saves,
            row.comments,
            row.views,
          ]),
        ),
      ];
      break;
    case "reports":
      result = [
        "notenarchiv-meldungen.csv",
        toCsv(
          ["Datum", "Name", "Nr.", "Stück", "ID", "Meldung"],
          notes.map((row) => [
            dateTime(row.at),
            row.name,
            row.song.number ?? "",
            row.song.title,
            row.song.id,
            row.text,
          ]),
        ),
      ];
      break;
    case "comments":
      result = [
        "notenarchiv-kommentare.csv",
        toCsv(
          ["Datum", "Name", "Nr.", "Stück", "Kommentar"],
          notes.map((row) => [
            dateTime(row.at),
            row.name,
            row.song.number ?? "",
            row.song.title,
            row.text,
          ]),
        ),
      ];
      break;
    default:
      result = [
        "notenarchiv-stuecke.csv",
        toCsv(
          [
            "Nr.",
            "Titel",
            "Sparte",
            "Anlass",
            "Komponist",
            "Bearbeitung",
            ...Object.values(SONG_COLUMNS),
          ],
          songs.map((row) => [
            row.song.number ?? "",
            row.song.title,
            row.song.genre ?? "",
            row.song.occasion ?? "",
            row.song.composer ?? "",
            row.song.arranger ?? "",
            row.votes === 0 ? "" : decimal(row.average),
            row.votes,
            row.likes,
            row.saves,
            row.comments,
            row.views,
          ]),
        ),
      ];
  }
  return result;
}

/** A number with one decimal, German style. */
function decimal(value: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: AVERAGE_DIGITS,
    maximumFractionDigits: AVERAGE_DIGITS,
  });
}

/** A moment as German date and time. */
function dateTime(at: number): string {
  return new Date(at).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
