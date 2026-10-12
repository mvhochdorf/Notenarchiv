/**
 * One full-screen page of the feed: a piece, its video, its stars, and the
 * like, comment, save and share buttons.
 *
 * @module
 */
"use client";

import type { ReactElement } from "react";
import { mark, rate } from "@/lib/archive-store";
import { genreHue } from "@/lib/genre-color";
import {
  searchUrl,
  thumbnailUrl,
  watchUrl,
  type FixedMedia,
} from "@/lib/media";
import type { RatingSummary } from "@/lib/ratings";
import type { Song } from "@/lib/song";
import { Icon, type IconName } from "./icons";
import { StarRating } from "./star-rating";
import { VideoPlayer } from "./video-player";

/** Digits shown of an average. */
const AVERAGE_DIGITS = 1;

/** What the visitors did with a piece, for the button column. */
export type CardSocial = {
  readonly liked: boolean;
  readonly likes: number;
  readonly saved: boolean;
  readonly saves: number;
  readonly comments: number;
};

/**
 * Renders the card.
 *
 * @param props - the piece and its data, whether it is the one on screen
 *   (only that one plays), the sound state, likes, saves and comments, and
 *   the card's actions
 * @returns the card, filling its parent
 */
export function SongCard({
  song,
  media,
  summary,
  mine,
  active,
  preload,
  muted,
  social,
  onUnmute,
  onEditVideo,
  onComments,
  onEnded,
}: {
  readonly song: Song;
  readonly media: FixedMedia | undefined;
  readonly summary: RatingSummary;
  readonly mine: number | null;
  readonly active: boolean;
  /** Whether to load the player ahead of time, for swiping on. */
  readonly preload: boolean;
  readonly muted: boolean;
  readonly social: CardSocial;
  readonly onUnmute: () => void;
  readonly onEditVideo: () => void;
  readonly onComments: () => void;
  readonly onEnded: () => void;
}): ReactElement {
  const hue = genreHue(song.genre);
  const people = [
    song.composer && `Komponist: ${song.composer}`,
    song.arranger &&
      song.arranger !== song.composer &&
      `Bearbeitung: ${song.arranger}`,
  ].filter(Boolean);
  const details = [
    song.publisher,
    song.collection,
    song.folderNumber && `Ordner-Nr. ${song.folderNumber}`,
  ].filter(Boolean);
  const query = [song.title, song.composer].filter(Boolean).join(" ");

  return (
    <article
      className="relative flex h-full snap-start snap-always flex-col overflow-hidden"
      style={{
        background: `radial-gradient(circle at 30% 20%, hsl(${hue} 70% 32%), hsl(${hue} 60% 10%) 60%, #000)`,
      }}
    >
      {media === undefined ? (
        <div className="flex flex-1 items-center justify-center px-4 pt-16 pb-72">
          <div className="w-full max-w-xl">
            <Placeholder
              onEditVideo={onEditVideo}
              searchHref={searchUrl(query)}
            />
          </div>
        </div>
      ) : active || preload ? (
        <VideoPlayer
          media={media}
          active={active}
          muted={muted}
          title={song.title}
          onEnded={onEnded}
          onUnmute={onUnmute}
          onDoubleTap={() => void mark("likes", song.id, true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a remote still; a static export has no image optimizer
        <img
          src={thumbnailUrl(media)}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Shade behind the filter bar, so it stays readable on any video. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />

      {/* Info and buttons lie over the video; the empty parts let taps
          through to it, so tapping anywhere pauses. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-24 pb-12">
        <div className="pointer-events-auto min-w-0 flex-1 space-y-2 [text-shadow:0_1px_4px_rgb(0_0_0/0.8)]">
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {song.number !== null && <Chip>Nr. {song.number}</Chip>}
            {song.genre !== null && <Chip>{song.genre}</Chip>}
            {song.occasion !== null && <Chip>{song.occasion}</Chip>}
            {song.solo !== null && <Chip>Solo: {song.solo}</Chip>}
          </div>
          <h2 className="text-2xl leading-tight font-extrabold text-balance sm:text-3xl">
            {song.title}
          </h2>
          {people.length > 0 && (
            <p className="text-sm text-white/80">{people.join(" · ")}</p>
          )}
          {details.length > 0 && (
            <p className="text-xs text-white/50">{details.join(" · ")}</p>
          )}
          {media !== undefined && (
            <p className="flex gap-3 text-xs text-white/60">
              <button
                type="button"
                onClick={onEditVideo}
                className="underline-offset-2 hover:text-white hover:underline"
              >
                Video ändern
              </button>
              <a
                href={watchUrl(media)}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-2 hover:text-white hover:underline"
              >
                Auf YouTube ansehen ↗
              </a>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
            <StarRating
              value={mine}
              onRate={(stars) => void rate(song.id, stars)}
            />
            <span className="text-sm text-white/70">
              {summary.count === 0
                ? "Noch keine Bewertung"
                : `Ø ${summary.average.toFixed(AVERAGE_DIGITS)} · ${summary.count} ${summary.count === 1 ? "Stimme" : "Stimmen"}`}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-4 pb-1">
          <ActionButton
            label={String(social.likes)}
            icon="heart"
            active={social.liked ? "text-rose-500" : null}
            pressed={social.liked}
            title={social.liked ? "Gefällt mir nicht mehr" : "Gefällt mir"}
            onClick={() => void mark("likes", song.id, !social.liked)}
          />
          <ActionButton
            label={String(social.comments)}
            icon="comment"
            title="Kommentare"
            onClick={onComments}
          />
          <ActionButton
            label={String(social.saves)}
            icon="bookmark"
            active={social.saved ? "text-amber-400" : null}
            pressed={social.saved}
            title={social.saved ? "Nicht mehr merken" : "Merken"}
            onClick={() => void mark("saved", song.id, !social.saved)}
          />
          <ActionButton
            label="Teilen"
            icon="share"
            title="Teilen"
            onClick={() => void share(song)}
          />
        </div>
      </div>
    </article>
  );
}

/** What is shown for a piece without a video. */
function Placeholder({
  onEditVideo,
  searchHref,
}: {
  readonly onEditVideo: () => void;
  readonly searchHref: string;
}): ReactElement {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/30 text-center">
      <span className="text-6xl">🎺</span>
      <p className="text-sm text-white/70">Noch kein Video verknüpft</p>
      <div className="flex gap-2 text-sm">
        <a
          href={searchHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20"
        >
          Suchen ↗
        </a>
        <button
          type="button"
          onClick={onEditVideo}
          className="rounded-full bg-amber-400 px-3 py-1.5 font-semibold text-black"
        >
          Video verknüpfen
        </button>
      </div>
    </div>
  );
}

/** A small label on the card. */
function Chip({
  children,
}: {
  readonly children: React.ReactNode;
}): ReactElement {
  return (
    <span className="rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
      {children}
    </span>
  );
}

/** One round button of the action column. */
function ActionButton({
  label,
  icon,
  title,
  onClick,
  active = null,
  pressed,
}: {
  readonly label: string;
  readonly icon: IconName;
  readonly title: string;
  readonly onClick: () => void;
  /** Colour class of the icon while the button is on, null while off. */
  readonly active?: string | null;
  /** On/off state for screen readers; omit for plain actions. */
  readonly pressed?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      className="group flex flex-col items-center gap-1"
    >
      <span
        className={`flex size-12 items-center justify-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] transition-transform group-active:scale-125 ${
          active ?? "text-white"
        }`}
      >
        <Icon name={icon} />
      </span>
      <span className="text-xs font-semibold text-white/90 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
        {label}
      </span>
    </button>
  );
}

/** Shares the piece's address, or copies it where sharing is not offered. */
async function share(song: Song): Promise<void> {
  const url = `${window.location.origin}${window.location.pathname}#${song.id}`;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: song.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      window.alert("Link kopiert");
    }
  } catch {
    // Cancelled by the visitor - nothing to do.
  }
}
