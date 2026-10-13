/**
 * The swipeable feed: one piece per screen, video playing, the feeds "Neu",
 * "Für dich" and "Trend" to choose from at the top.
 *
 * @module
 */
"use client";

import Link from "next/link";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  mark,
  useArchive,
  type ArchiveState,
  type NoteKind,
} from "@/lib/archive-store";
import { reshuffle, useHashSongId, useVisitSeed } from "@/lib/browser-values";
import {
  categories,
  filterSongs,
  NO_FILTER,
  SONGS,
  type Category,
} from "@/lib/library";
import { mediaFor } from "@/lib/media";
import { NO_RATING } from "@/lib/ratings";
import { FEED_TABS, rankFeed, type FeedTab } from "@/lib/recommend";
import { isShown, useSettings, type ShowFilter } from "@/lib/settings";
import type { Song } from "@/lib/song";
import { isMarked, markCount } from "@/lib/social";
import { ClubLogo } from "./club-logo";
import { CommentsSheet } from "./comments-sheet";
import { LinkVideoDialog } from "./link-video-dialog";
import { ModeNotice } from "./mode-notice";
import { SongCard } from "./song-card";

/** Cards rendered on each side of the visible one; the rest are empty. */
const RENDER_AROUND = 2;

/**
 * Which cards around the visible one load their player ahead of time.
 *
 * @remarks
 * The next two and the one before: their players are ready, so swiping on
 * starts the video at once instead of after a second of loading.
 */
const PRELOAD_BEFORE = 1;
const PRELOAD_AFTER = 2;

/** How long a piece has to be on screen to count as seen. */
const SEEN_AFTER_MS = 3000;

/** The feed and category chosen by the visitor. */
type FeedChoice = {
  readonly genre: string | null;
  readonly tab: FeedTab;
};

/**
 * Renders the feed.
 *
 * @returns the full-height feed with its tabs
 * @remarks
 * The order is worked out once, when everything has loaded, and then kept:
 * live likes and views - including the visitor's own - must not move the
 * cards while somebody is swiping through them. Choosing a tab again works
 * it out anew.
 */
export function Feed(): ReactElement {
  const archive = useArchive();
  const seed = useVisitSeed();
  const hashId = useHashSongId();
  const { show } = useSettings();
  const [choice, setChoice] = useState<FeedChoice>({
    genre: null,
    tab: "forYou",
  });
  const [frozen, setFrozen] = useState<readonly Song[] | null>(null);
  const [active, setActive] = useState(0);
  // Sound is on; only a browser that blocks it before the first touch makes
  // the feed start silent, see VideoPlayer's onSoundBlocked.
  const [muted, setMuted] = useState(false);
  const [shownHash, setShownHash] = useState<string | null>(null);
  const [editing, setEditing] = useState<Song | null>(null);
  const [commenting, setCommenting] = useState<{
    song: Song;
    kind: NoteKind;
  } | null>(null);
  const dialogOpen = editing !== null || commenting !== null;
  const scroller = useRef<HTMLDivElement>(null);

  if (frozen === null && seed !== null && hashId !== null && archive.ready) {
    // Set while rendering, as React allows for state derived from props:
    // the first order is fixed as soon as it can be worked out.
    setFrozen(buildList(choice, show, archive, seed, hashId || null));
    setShownHash(hashId);
  } else if (frozen !== null && hashId !== null && hashId !== shownHash) {
    // A piece chosen in the archive arrives in the address only after the
    // feed has been laid out - put it first then.
    setShownHash(hashId);
    const first = SONGS.find((song) => song.id === hashId);
    if (first !== undefined && frozen[0] !== first) {
      setFrozen([first, ...frozen.filter((song) => song !== first)]);
      setActive(0);
    }
  }
  const activeId = frozen?.[active]?.id ?? null;

  const markSeen = useEffectEvent((songId: string) => {
    if (!isMarked(archive.views, songId, archive.me)) {
      void mark("views", songId, true);
    }
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (activeId !== null) {
      timer = setTimeout(() => markSeen(activeId), SEEN_AFTER_MS);
    }
    return () => clearTimeout(timer);
  }, [activeId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [shownHash]);

  useEffect(() => {
    let cleanup: () => void = () => undefined;
    if (muted) {
      // The browser lets sound play once the page was touched. Any touch
      // will do - except a tap on the video, which turns the sound on itself
      // (and must not pause it as well).
      const unmute = (event: Event) => {
        const target = event.target as Element | null;
        if ((target?.closest("[data-video-tap]") ?? null) === null) {
          setMuted(false);
        }
      };
      const events = ["pointerdown", "keydown", "touchend"] as const;
      events.forEach((name) => window.addEventListener(name, unmute));
      cleanup = () =>
        events.forEach((name) => window.removeEventListener(name, unmute));
    }
    return cleanup;
  }, [muted]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const box = scroller.current;
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (box !== null && step !== undefined && !dialogOpen) {
        event.preventDefault();
        box.scrollBy({ top: step * box.clientHeight, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen]);

  let content: ReactElement;
  if (frozen === null) {
    content = (
      <div className="flex h-full items-center justify-center">
        <span className="size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      </div>
    );
  } else {
    const songs = frozen;

    const choose = (next: FeedChoice) => {
      setChoice(next);
      setFrozen(buildList(next, show, archive, reshuffle(), null));
      setActive(0);
      scroller.current?.scrollTo({ top: 0 });
    };

    content = (
      <>
        <div
          ref={scroller}
          onScroll={(event) => {
            const box = event.currentTarget;
            setActive(Math.round(box.scrollTop / box.clientHeight));
          }}
          className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
        >
          {songs.length === 0 && (
            <div className="flex h-full items-center justify-center p-8 text-center text-white/70">
              <p>
                Keine Stücke für diese Auswahl.
                <br />
                <Link
                  href="/einstellungen/"
                  className="text-amber-400 underline"
                >
                  Anzeige in den Einstellungen ändern
                </Link>
              </p>
            </div>
          )}
          {songs.map((song, index) =>
            Math.abs(index - active) <= RENDER_AROUND ? (
              <SongCard
                key={song.id}
                song={song}
                media={mediaFor(archive.media, song.id)}
                summary={archive.summaries.get(song.id) ?? NO_RATING}
                mine={archive.mine[song.id] ?? null}
                active={index === active}
                preload={
                  index >= active - PRELOAD_BEFORE &&
                  index <= active + PRELOAD_AFTER
                }
                muted={muted}
                social={{
                  liked: isMarked(archive.likes, song.id, archive.me),
                  likes: markCount(archive.likes, song.id),
                  saved: isMarked(archive.saved, song.id, archive.me),
                  saves: markCount(archive.saved, song.id),
                  comments: Object.keys(archive.comments[song.id] ?? {}).length,
                }}
                onUnmute={() => setMuted(false)}
                onSoundBlocked={() => setMuted(true)}
                onComments={() => setCommenting({ song, kind: "comments" })}
                onReport={() => setCommenting({ song, kind: "reports" })}
                onEnded={() => {
                  const box = scroller.current;
                  box?.scrollBy({ top: box.clientHeight, behavior: "smooth" });
                }}
                onEditVideo={() => {
                  // Keeps the card in place when a new link changes whether
                  // the piece passes the show filter.
                  setFrozen(songs);
                  setEditing(song);
                }}
              />
            ) : (
              <div key={song.id} className="h-full snap-start" />
            ),
          )}
        </div>
        <FilterBar
          choice={choice}
          onChoose={choose}
          mode={archive.mode}
          genres={categories(
            SONGS.filter((song) => isShown(show, archive.media, song)),
            "genre",
          )}
        />
      </>
    );
  }

  return (
    <div className="relative h-full w-full">
      {content}
      {editing !== null && (
        <LinkVideoDialog
          song={editing}
          current={mediaFor(archive.media, editing.id)}
          ownLink={archive.media[editing.id] !== undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {commenting !== null && (
        <CommentsSheet
          song={commenting.song}
          kind={commenting.kind}
          onClose={() => setCommenting(null)}
        />
      )}
    </div>
  );
}

/** The tabs and the category filter floating over the top of the feed. */
function FilterBar({
  choice,
  onChoose,
  mode,
  genres,
}: {
  readonly choice: FeedChoice;
  readonly onChoose: (choice: FeedChoice) => void;
  readonly mode: ArchiveState["mode"];
  readonly genres: readonly Category[];
}): ReactElement {
  return (
    <div className="absolute inset-x-0 top-0 z-10 space-y-2 px-4 pt-3">
      <div className="flex items-center gap-2">
        <span className="w-24">
          <ClubLogo className="size-9 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
        </span>
        <nav className="flex flex-1 justify-center gap-5" aria-label="Auswahl">
          {FEED_TABS.map(({ tab, label }) => (
            <button
              key={tab}
              type="button"
              aria-current={choice.tab === tab ? "page" : undefined}
              onClick={() => onChoose({ ...choice, tab })}
              className={`relative pb-1.5 text-base font-bold whitespace-nowrap [text-shadow:0_1px_4px_rgb(0_0_0/0.8)] ${
                choice.tab === tab
                  ? "text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded after:bg-white"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <select
          aria-label="Sparte"
          value={choice.genre ?? ""}
          onChange={(event) =>
            onChoose({ ...choice, genre: event.target.value || null })
          }
          className="w-24 truncate rounded-full bg-black/40 px-2 py-1 text-xs font-semibold backdrop-blur outline-none"
        >
          <option value="">Alle Sparten</option>
          {genres.map((genre) => (
            <option key={genre.name} value={genre.name}>
              {genre.name} ({genre.count})
            </option>
          ))}
        </select>
      </div>
      <ModeNotice mode={mode} />
    </div>
  );
}

/** The feed's pieces for a choice, a linked piece first if there is one. */
function buildList(
  choice: FeedChoice,
  show: ShowFilter,
  archive: ArchiveState,
  seed: number,
  firstId: string | null,
): readonly Song[] {
  const ranked = rankFeed(
    choice.tab,
    filterSongs(SONGS, { ...NO_FILTER, genre: choice.genre }).filter((song) =>
      isShown(show, archive.media, song),
    ),
    {
      votes: archive.votes,
      summaries: archive.summaries,
      likes: archive.likes,
      saved: archive.saved,
      views: archive.views,
      comments: archive.comments,
      me: archive.me,
    },
    seed,
  );
  const first = SONGS.find((song) => song.id === firstId);
  return first === undefined
    ? ranked
    : [first, ...ranked.filter((song) => song !== first)];
}
