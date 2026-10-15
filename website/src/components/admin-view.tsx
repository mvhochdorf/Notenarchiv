/**
 * The admin page: signing in, the pieces of the catalog and the reports.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import { deleteReport, signInAdmin, signOutAdmin, useAdmin } from "@/lib/admin";
import { useArchive, type ArchiveState } from "@/lib/archive-store";
import { CLUB } from "@/lib/club";
import { filterSongs, HIDDEN_GENRES, NO_FILTER } from "@/lib/library";
import { commentsOf, timeAgo } from "@/lib/social";
import type { Song } from "@/lib/song";
import { ClubLogo } from "./club-logo";
import { SongEditor } from "./song-editor";

/** Most pieces listed at once; a search narrows the rest down. */
const MAX_LISTED = 100;

/** The parts of the admin page. */
type Tab = "songs" | "reports";

/** Which pieces the list shows. */
type Scope = "all" | "withoutVideo" | "reported" | "hidden";

/** Labels of the scopes, for the select. */
const SCOPE_LABELS: Readonly<Record<Scope, string>> = {
  all: "Alle Stücke",
  withoutVideo: "Ohne Video",
  reported: "Mit Meldungen",
  hidden: "Ausgeblendete Sparten",
};

/** The piece being edited: an existing one, or a new one (null). */
type Editing = { readonly song: Song | null } | null;

/**
 * Renders the admin page.
 *
 * @returns the sign-in, or the catalog and reports once signed in
 */
export function AdminView(): ReactElement {
  const admin = useAdmin();
  let content: ReactElement;

  switch (admin.status) {
    case "unavailable":
      content = (
        <p className="text-white/70">
          Die Verwaltung braucht Firebase - im lokalen Modus gibt es nichts zu
          verwalten.
        </p>
      );
      break;
    case "signedOut":
      content = <SignIn />;
      break;
    case "denied":
      content = (
        <div className="space-y-3 rounded-2xl bg-amber-400/10 p-4 text-sm">
          <p className="text-amber-200">
            Angemeldet, aber dieses Konto ist noch nicht als Verwaltung
            eingetragen. In der Firebase-Konsole unter Realtime Database bei{" "}
            <code>notenarchiv/admins</code> diesen Eintrag anlegen (siehe
            docs/verwaltung.md):
          </p>
          <p className="font-mono break-all select-all">{admin.uid}: true</p>
          <SignOutButton />
        </div>
      );
      break;
    case "signedIn":
      content = <Workspace />;
      break;
    default:
      content = (
        <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <ClubLogo className="size-10" />
        <h1 className="mr-auto text-2xl font-black tracking-tight">
          Verwaltung
        </h1>
        {admin.status === "signedIn" && <SignOutButton />}
      </div>
      {content}
    </div>
  );
}

/** Asks for the shared password. */
function SignIn(): ReactElement {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError((await signInAdmin(password)) ?? "");
    setBusy(false);
  };

  return (
    <form
      className="space-y-3 rounded-2xl bg-white/5 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm text-white/70">
        Hier werden die Stücke von {CLUB.appName} gepflegt. Bitte das
        Verwaltungs-Passwort eingeben.
      </p>
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-label="Passwort"
        placeholder="Passwort"
        className="w-full rounded-xl bg-zinc-800 px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400"
        autoFocus
      />
      {error !== "" && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || password === ""}
        className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-40"
      >
        Anmelden
      </button>
    </form>
  );
}

/** Signs the admin out on this device. */
function SignOutButton(): ReactElement {
  return (
    <button
      type="button"
      onClick={() => void signOutAdmin()}
      className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm"
    >
      Abmelden
    </button>
  );
}

/** The catalog and the reports, for a signed-in admin. */
function Workspace(): ReactElement {
  const archive = useArchive();
  const [tab, setTab] = useState<Tab>("songs");
  const [editing, setEditing] = useState<Editing>(null);
  const reports = reportList(archive);
  let content: ReactElement;

  if (!archive.ready) {
    content = (
      <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
    );
  } else if (archive.mode !== "online") {
    content = (
      <p className="text-white/70">
        Keine Verbindung zur Datenbank - bitte die Seite neu laden.
      </p>
    );
  } else if (tab === "songs") {
    content = (
      <SongTable archive={archive} onEdit={(song) => setEditing({ song })} />
    );
  } else {
    content = (
      <ReportList reports={reports} onEdit={(song) => setEditing({ song })} />
    );
  }

  return (
    <>
      {archive.mode === "online" && (
        <nav className="flex gap-2" aria-label="Bereich">
          {(
            [
              ["songs", `Stücke (${archive.catalog.songs.length})`],
              ["reports", `Meldungen (${reports.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-current={tab === value ? "page" : undefined}
              onClick={() => setTab(value)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                tab === value
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {content}
      {editing !== null && (
        <SongEditor
          // A fresh form for every piece.
          key={editing.song?.id ?? "new"}
          song={editing.song}
          catalog={archive.catalog}
          linked={
            editing.song === null ? undefined : archive.media[editing.song.id]
          }
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/** The pieces with search and scope, each opening the form. */
function SongTable({
  archive,
  onEdit,
}: {
  readonly archive: ArchiveState;
  readonly onEdit: (song: Song | null) => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const { catalog } = archive;
  const hasVideo = (song: Song) =>
    archive.media[song.id] !== undefined ||
    catalog.videos[song.id] !== undefined;
  const reportCount = (song: Song) =>
    Object.keys(archive.reports[song.id] ?? {}).length;
  const inScope: Readonly<Record<Scope, (song: Song) => boolean>> = {
    all: () => true,
    withoutVideo: (song) => !hasVideo(song),
    reported: (song) => reportCount(song) > 0,
    hidden: (song) => song.genre !== null && HIDDEN_GENRES.has(song.genre),
  };
  const found = filterSongs(catalog.songs, { ...NO_FILTER, query }).filter(
    inScope[scope],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titel, Nummer, Komponist ..."
          aria-label="Suchen"
          className="min-w-0 flex-1 rounded-xl bg-white/5 px-4 py-2 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value as Scope)}
          aria-label="Auswahl"
          className="rounded-xl bg-white/5 px-3 py-2 outline-none"
        >
          {Object.entries(SCOPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onEdit(null)}
          className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black"
        >
          + Neues Stück
        </button>
      </div>
      <p className="text-sm text-white/50">
        {found.length} Stücke
        {found.length > MAX_LISTED &&
          ` - die ersten ${MAX_LISTED}, die Suche grenzt weiter ein`}
      </p>
      <ul className="divide-y divide-white/5 rounded-2xl bg-white/5">
        {found.slice(0, MAX_LISTED).map((song) => (
          <li key={song.id}>
            <button
              type="button"
              onClick={() => onEdit(song)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5"
            >
              <span className="w-14 shrink-0 text-sm text-white/50 tabular-nums">
                {song.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {song.title}
                </span>
                <span className="block truncate text-sm text-white/50">
                  {[song.genre, song.composer].filter(Boolean).join(" · ")}
                </span>
              </span>
              {reportCount(song) > 0 && (
                <span className="text-sm text-amber-300">
                  ⚑ {reportCount(song)}
                </span>
              )}
              <span
                className={`text-sm ${hasVideo(song) ? "" : "text-white/30"}`}
                title={hasVideo(song) ? "mit Video" : "ohne Video"}
              >
                {hasVideo(song) ? "🎬" : "–"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One report and the piece it is about. */
type ReportItem = {
  readonly songId: string;
  readonly reportId: string;
  readonly song: Song | undefined;
  readonly name: string;
  readonly text: string;
  readonly at: number;
};

/** Every report, newest first. */
function reportList(archive: ArchiveState): readonly ReportItem[] {
  return Object.keys(archive.reports)
    .flatMap((songId) =>
      commentsOf(archive.reports, songId).map((report) => ({
        songId,
        reportId: report.id,
        song: archive.catalog.songs.find((song) => song.id === songId),
        name: report.name,
        text: report.text,
        at: report.at,
      })),
    )
    .sort((a, b) => b.at - a.at);
}

/** The reports, each with a way to fix the piece and to close it. */
function ReportList({
  reports,
  onEdit,
}: {
  readonly reports: readonly ReportItem[];
  readonly onEdit: (song: Song) => void;
}): ReactElement {
  const [now] = useState(() => Date.now());
  const [error, setError] = useState("");

  const close = async (report: ReportItem) => {
    setError("");
    try {
      await deleteReport(report.songId, report.reportId);
    } catch {
      setError(
        "Löschen abgelehnt - sind die Regeln aus database.rules.json veröffentlicht?",
      );
    }
  };

  return (
    <div className="space-y-3">
      {error !== "" && <p className="text-sm text-red-400">{error}</p>}
      {reports.length === 0 && (
        <p className="text-white/60">Keine offenen Meldungen.</p>
      )}
      {reports.map((report) => (
        <div
          key={report.reportId}
          className="space-y-2 rounded-2xl bg-white/5 p-4"
        >
          <p className="font-semibold">
            {report.song?.title ?? `${report.songId} (gelöscht)`}
          </p>
          <p className="whitespace-pre-line">{report.text}</p>
          <p className="text-sm text-white/50">
            {report.name} ·{timeAgo(report.at, now)}
          </p>
          <div className="flex gap-2">
            {report.song !== undefined && (
              <button
                type="button"
                onClick={() => report.song !== undefined && onEdit(report.song)}
                className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm"
              >
                Stück bearbeiten
              </button>
            )}
            <button
              type="button"
              onClick={() => void close(report)}
              className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
            >
              ✓ Erledigt
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
