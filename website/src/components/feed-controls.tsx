/**
 * The controls at the top right of Play: choosing the categories and
 * searching.
 *
 * @module
 */
"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { ArchiveState } from "@/lib/archive-store";
import { filterSongs, NO_FILTER, type Category } from "@/lib/library";
import { mediaFor, thumbnailUrl } from "@/lib/media";
import { changeSettings, useSettings } from "@/lib/settings";
import type { Song } from "@/lib/song";
import { markCount } from "@/lib/social";

/** Most pieces a search shows; a longer query narrows them down. */
const MAX_RESULTS = 60;

/** Outline of the magnifier, in a 24 by 24 box. */
const SEARCH_PATH = "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM16 16l5 5";

/** Outline of the category filter (three sliders), in a 24 by 24 box. */
const FILTER_PATH =
  "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4";

/** Shared look of the round buttons over the video. */
const ROUND_BUTTON =
  "flex size-9 items-center justify-center rounded-full bg-black/40 backdrop-blur";

/**
 * The button and menu for the categories Play shows.
 *
 * @param props - the categories there are, and what to do after a change
 * @returns the button, and the menu when open
 * @remarks
 * Several categories can be on at once. The choice is kept in this browser
 * (see settings.ts). While not every category is on, the button wears a
 * coloured ring, so a narrowed Play is never mistaken for the whole archive.
 */
export function GenreMenu({
  genres,
  onChange,
}: {
  readonly genres: readonly Category[];
  readonly onChange: (off: readonly string[]) => void;
}): ReactElement {
  const { playGenresOff } = useSettings();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Only categories that still exist count; old choices are ignored.
  const off = new Set(
    playGenresOff.filter((genre) => genres.some((each) => each.name === genre)),
  );
  const narrowed = off.size > 0;

  useEffect(() => {
    let cleanup: () => void = () => undefined;
    if (open) {
      // Any touch outside the menu closes it - also on the video's own
      // controls, which lie above anything the menu could put behind it.
      const outside = (event: Event) => {
        if (!(box.current?.contains(event.target as Node) ?? false)) {
          setOpen(false);
        }
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      };
      document.addEventListener("pointerdown", outside, true);
      document.addEventListener("keydown", escape);
      cleanup = () => {
        document.removeEventListener("pointerdown", outside, true);
        document.removeEventListener("keydown", escape);
      };
    }
    return cleanup;
  }, [open]);

  const choose = (next: ReadonlySet<string>) => {
    const list = [...next];
    changeSettings({ playGenresOff: list });
    onChange(list);
  };

  const toggle = (genre: string) => {
    const next = new Set(off);
    if (next.has(genre)) {
      next.delete(genre);
    } else {
      next.add(genre);
    }
    choose(next);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={
          narrowed
            ? `Sparten: ${genres.length - off.size} von ${genres.length}`
            : "Sparten: alle"
        }
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${ROUND_BUTTON} ${narrowed ? "ring-2 ring-amber-400" : ""}`}
      >
        <LineIcon path={FILTER_PATH} />
      </button>
      {narrowed && (
        <span className="pointer-events-none absolute -right-1 -bottom-1 min-w-4 rounded-full bg-amber-400 px-1 text-center text-[10px] leading-4 font-bold text-black">
          {genres.length - off.size}
        </span>
      )}
      {open && (
        <div className="absolute top-11 right-0 z-30 max-h-[70dvh] w-64 overflow-y-auto rounded-2xl bg-zinc-900/95 p-2 shadow-2xl backdrop-blur">
          <div className="flex gap-1 p-1">
            <button
              type="button"
              onClick={() => choose(new Set())}
              className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-sm font-semibold hover:bg-white/15"
            >
              Alle
            </button>
            <button
              type="button"
              onClick={() => choose(new Set(genres.map((each) => each.name)))}
              className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-sm font-semibold hover:bg-white/15"
            >
              Keine
            </button>
          </div>
          {genres.map((genre) => (
            <label
              key={genre.name}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={!off.has(genre.name)}
                onChange={() => toggle(genre.name)}
                className="size-4 accent-amber-400"
              />
              <span className="flex-1 truncate">{genre.name}</span>
              <span className="text-sm text-white/50">{genre.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The magnifier that opens the search.
 *
 * @param props - what to do when tapped
 * @returns the button
 */
export function SearchButton({
  onClick,
}: {
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label="Suchen"
      onClick={onClick}
      className={ROUND_BUTTON}
    >
      <LineIcon path={SEARCH_PATH} />
    </button>
  );
}

/**
 * The search over Play: pieces as a grid of videos, as TikTok shows them.
 *
 * @param props - the pieces to search, the archive's state, what to do with
 *   a chosen piece and how to close
 * @returns the full-screen search
 * @remarks
 * Two columns on a phone - about four videos at once -, more on a wider
 * screen. Choosing one plays the results from there on.
 */
export function SearchOverlay({
  songs,
  archive,
  onPlay,
  onClose,
}: {
  readonly songs: readonly Song[];
  readonly archive: ArchiveState;
  readonly onPlay: (
    results: readonly Song[],
    index: number,
    query: string,
  ) => void;
  readonly onClose: () => void;
}): ReactElement {
  const [query, setQuery] = useState("");
  const results =
    query.trim() === ""
      ? []
      : filterSongs(songs, { ...NO_FILTER, query }).slice(0, MAX_RESULTS);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-zinc-950">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          aria-label="Zurück"
          onClick={onClose}
          className="flex size-10 items-center justify-center text-2xl"
        >
          ‹
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-full bg-white/10 px-4">
          <LineIcon path={SEARCH_PATH} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Titel, Komponist, Nummer ..."
            aria-label="Suchen"
            className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {query.trim() !== "" && results.length === 0 && (
          <p className="p-6 text-center text-white/60">Nichts gefunden.</p>
        )}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((song, index) => {
            const media = mediaFor(archive, song.id);
            return (
              <button
                key={song.id}
                type="button"
                onClick={() => onPlay(results, index, query)}
                className="relative aspect-[3/4] overflow-hidden rounded-lg bg-zinc-800 text-left"
              >
                {media === undefined ? (
                  <span className="flex h-full items-center justify-center text-5xl">
                    🎺
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimization
                  <img
                    src={thumbnailUrl(media)}
                    alt=""
                    loading="lazy"
                    // YouTube's still is 4:3 with black bars around a 16:9
                    // picture; enlarged, the bars fall outside the tile.
                    className="h-full w-full scale-[1.34] object-cover"
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
                  <span className="line-clamp-2 text-sm leading-tight font-semibold">
                    {song.title}
                  </span>
                  <span className="mt-0.5 flex gap-2 text-xs text-white/70">
                    {song.composer !== null && (
                      <span className="truncate">{song.composer}</span>
                    )}
                    <span className="ml-auto shrink-0">
                      ♥ {markCount(archive.likes, song.id)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A small white line icon. */
function LineIcon({ path }: { readonly path: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
