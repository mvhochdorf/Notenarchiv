/**
 * The whole archive as a searchable, sortable list.
 *
 * @module
 */
"use client";

import Link from "next/link";
import { useDeferredValue, type ReactElement } from "react";
import { mark, rate, useArchive } from "@/lib/archive-store";
import {
  changeArchiveView,
  queueForPlay,
  useArchiveView,
  type ArchiveScope,
} from "@/lib/archive-view";
import { useVisitSeed } from "@/lib/browser-values";
import {
  categories,
  filterSongs,
  SONGS,
  SORT_LABELS,
  sortSongs,
  type SortOrder,
} from "@/lib/library";
import { mediaFor } from "@/lib/media";
import { NO_RATING } from "@/lib/ratings";
import { isMarked, markCount } from "@/lib/social";
import type { Song } from "@/lib/song";
import { isShown, SHOW_OPTIONS, useSettings } from "@/lib/settings";
import { ClubLogo } from "./club-logo";
import { Icon } from "./icons";
import { ModeNotice } from "./mode-notice";
import { StarRating } from "./star-rating";

/** Orders offered in the list. */
const LIST_ORDERS: readonly SortOrder[] = [
  "title",
  "popular",
  "number",
  "unrated",
];

/** The buttons above the list, by the scope they choose. */
const SCOPES: readonly { scope: ArchiveScope; label: string }[] = [
  { scope: "all", label: "Alle" },
  { scope: "saved", label: "🔖 Gespeichert" },
  { scope: "reported", label: "⚠ Anmerkungen" },
];

/** Digits shown of an average. */
const AVERAGE_DIGITS = 1;

/**
 * Renders the list with its search and filters.
 *
 * @returns the archive page content
 * @remarks
 * Filters and order are kept between visits (see archive-view.ts). Opening
 * a piece hands the list's order to Play, so swiping on goes through the
 * list as shown here.
 */
export function SongList(): ReactElement {
  const archive = useArchive();
  const { show } = useSettings();
  const shown = SONGS.filter((song) => isShown(show, archive.media, song));
  const genres = categories(shown, "genre");
  const occasions = categories(shown, "occasion");
  const seed = useVisitSeed() ?? 0;
  const view = useArchiveView();
  const { order, scope } = view;
  const onlySaved = scope === "saved";
  const onlyReported = scope === "reported";
  // A remembered category that no longer exists - e.g. one hidden since -
  // counts as "all", so the list matches what the selects show.
  const genre = genres.some((entry) => entry.name === view.genre)
    ? view.genre
    : null;
  const occasion = occasions.some((entry) => entry.name === view.occasion)
    ? view.occasion
    : null;
  const deferredFilter = useDeferredValue({ ...view, genre, occasion });
  const isSaved = (song: Song) => isMarked(archive.saved, song.id, archive.me);
  const reportCount = (song: Song) =>
    Object.keys(archive.reports[song.id] ?? {}).length;
  const counts: Readonly<Record<ArchiveScope, number>> = {
    all: shown.length,
    saved: shown.filter(isSaved).length,
    reported: shown.filter((song) => reportCount(song) > 0).length,
  };

  const songs = sortSongs(
    filterSongs(shown, deferredFilter).filter(
      (song) =>
        (!onlySaved || isSaved(song)) &&
        (!onlyReported || reportCount(song) > 0),
    ),
    order,
    {
      summaries: archive.summaries,
      mine: archive.mine,
      likes: archive.likes,
      seed,
    },
  );

  const chipClass = (selected: boolean) =>
    `shrink-0 rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
      selected ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"
    }`;
  const selectClass =
    "rounded-xl bg-zinc-800 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 space-y-3 bg-zinc-950/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto flex items-center gap-2 text-2xl font-black tracking-tight">
            <ClubLogo className="size-9" />
            Notenarchiv
          </h1>
          <ModeNotice mode={archive.mode} />
        </div>
        <input
          type="search"
          value={view.query}
          onChange={(event) => changeArchiveView({ query: event.target.value })}
          placeholder="Titel, Komponist, Nummer ..."
          className="w-full rounded-xl bg-zinc-800 px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex gap-2">
          {SCOPES.map((option) => (
            <button
              key={option.scope}
              type="button"
              aria-pressed={scope === option.scope}
              className={chipClass(scope === option.scope)}
              onClick={() => changeArchiveView({ scope: option.scope })}
            >
              {option.label} ({counts[option.scope]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Sortierung"
            value={order}
            onChange={(event) =>
              changeArchiveView({ order: event.target.value as SortOrder })
            }
            className={selectClass}
          >
            {LIST_ORDERS.map((option) => (
              <option key={option} value={option}>
                {SORT_LABELS[option]}
              </option>
            ))}
          </select>
          <select
            aria-label="Sparte"
            value={genre ?? ""}
            onChange={(event) =>
              changeArchiveView({ genre: event.target.value || null })
            }
            className={selectClass}
          >
            <option value="">Alle Sparten</option>
            {genres.map((genre) => (
              <option key={genre.name} value={genre.name}>
                {genre.name} ({genre.count})
              </option>
            ))}
          </select>
          <select
            aria-label="Anlass"
            value={occasion ?? ""}
            onChange={(event) =>
              changeArchiveView({ occasion: event.target.value || null })
            }
            className={selectClass}
          >
            <option value="">Jeder Anlass</option>
            {occasions.map((occasion) => (
              <option key={occasion.name} value={occasion.name}>
                {occasion.name} ({occasion.count})
              </option>
            ))}
          </select>
          <Link
            href="/einstellungen/"
            className="ml-auto text-right text-sm text-white/50 hover:text-white"
          >
            {songs.length} Stücke
            {show !== "all" && (
              <span className="block text-xs">
                {SHOW_OPTIONS[show].label} ⚙
              </span>
            )}
          </Link>
        </div>
      </header>

      {songs.length === 0 && (
        <div className="space-y-3 px-4 py-10 text-center text-white/60">
          <p>Keine Stücke für diese Auswahl.</p>
          <button
            type="button"
            onClick={() =>
              changeArchiveView({
                query: "",
                genre: null,
                occasion: null,
                scope: "all",
              })
            }
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-black"
          >
            Filter zurücksetzen
          </button>
        </div>
      )}
      <ul className="divide-y divide-white/5 px-2 pb-4">
        {songs.map((song, index) => {
          const summary = archive.summaries.get(song.id) ?? NO_RATING;
          const likes = markCount(archive.likes, song.id);
          const liked = isMarked(archive.likes, song.id, archive.me);
          const reports = reportCount(song);
          return (
            <li
              key={song.id}
              className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-white/5"
            >
              {order === "popular" && (
                <span className="w-7 shrink-0 text-right text-sm font-bold text-white/40">
                  {index + 1}
                </span>
              )}
              {onlySaved && (
                // In the saved list, the bookmark in front takes a piece off it.
                <button
                  type="button"
                  onClick={() => void mark("saved", song.id, false)}
                  title="Nicht mehr merken"
                  aria-label={`${song.title} nicht mehr merken`}
                  className="shrink-0 text-amber-400 transition-transform hover:text-amber-300 active:scale-90"
                >
                  <Icon name="bookmark" size="small" />
                </button>
              )}
              <Link
                href={`/#${song.id}`}
                onClick={() =>
                  queueForPlay(
                    [...songs.slice(index), ...songs.slice(0, index)].map(
                      (piece) => piece.id,
                    ),
                  )
                }
                className="min-w-0 flex-1"
              >
                <span className="block truncate font-semibold">
                  {song.title}
                  {mediaFor(archive.media, song.id) !== undefined && (
                    <span className="ml-1.5" title="Video verknüpft">
                      🎬
                    </span>
                  )}
                  {reports > 0 && (
                    <span
                      className="ml-1.5 text-amber-400"
                      title={`${reports} Anmerkung(en)`}
                    >
                      ⚠{reports}
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-white/50">
                  {[
                    song.number && `Nr. ${song.number}`,
                    song.genre,
                    song.occasion,
                    song.composer,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <StarRating
                  value={archive.mine[song.id] ?? null}
                  onRate={(stars) => void rate(song.id, stars)}
                  size="medium"
                />
                <span className="flex items-center gap-2 text-xs text-white/50 tabular-nums">
                  <span>
                    {summary.count === 0
                      ? "Ø -"
                      : `Ø ${summary.average.toFixed(AVERAGE_DIGITS)} (${summary.count})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => void mark("likes", song.id, !liked)}
                    aria-pressed={liked}
                    aria-label={
                      liked ? "Gefällt mir nicht mehr" : "Gefällt mir"
                    }
                    title={liked ? "Gefällt mir nicht mehr" : "Gefällt mir"}
                    className={`flex items-center gap-0.5 transition-transform active:scale-125 ${
                      liked ? "text-rose-500" : "text-white/50 hover:text-white"
                    }`}
                  >
                    <Icon name="heart" size="small" />
                    {likes}
                  </button>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
