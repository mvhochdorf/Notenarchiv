/**
 * One full-screen page of the feed: a piece, its video, its stars, and the
 * like, comment, save and share buttons.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import { mark, rate } from "@/lib/archive-store";
import { genreHue } from "@/lib/genre-color";
import { searchUrl, thumbnailUrl, type FixedMedia } from "@/lib/media";
import type { RatingSummary } from "@/lib/ratings";
import type { Song } from "@/lib/song";
import { Icon, type IconName } from "./icons";
import { StarRating } from "./star-rating";
import { VideoPlayer } from "./video-player";

/** Digits shown of an average. */
const AVERAGE_DIGITS = 1;

/** How long the note after sharing stays. */
const SHARE_NOTE_MS = 6000;

/** How long the hint after saving a piece stays. */
const SAVED_HINT_MS = 3000;

/** What the visitors did with a piece, for the button column. */
export type CardSocial = {
  readonly liked: boolean;
  readonly likes: number;
  readonly saved: boolean;
  readonly saves: number;
  readonly comments: number;
  /** Notes about something wrong with the piece. */
  readonly reports: number;
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
  onSoundBlocked,
  onEditVideo,
  onComments,
  onReport,
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
  readonly onSoundBlocked: () => void;
  readonly onEditVideo: () => void;
  readonly onComments: () => void;
  readonly onReport: () => void;
  readonly onEnded: () => void;
}): ReactElement {
  const [savedHint, setSavedHint] = useState(false);
  // After sharing: "copied", or the address to copy by hand.
  const [shared, setShared] = useState<string | null>(null);
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
      className="relative flex h-full snap-start snap-always flex-col overflow-hidden select-none"
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
          onSoundBlocked={onSoundBlocked}
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

      {/* Info and buttons lie over the video. Everything but the stars and
          the buttons lets taps through to it - tapping the title pauses,
          double tapping it likes, as anywhere else on the video. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-24 pb-12">
        <div className="min-w-0 flex-1 space-y-2 [text-shadow:0_1px_4px_rgb(0_0_0/0.8)]">
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
            <div className="pointer-events-auto">
              <StarRating
                value={mine}
                onRate={(stars) => void rate(song.id, stars)}
              />
            </div>
            <span className="text-sm text-white/70">
              {summary.count === 0
                ? "Noch keine Bewertung"
                : `Ø ${summary.average.toFixed(AVERAGE_DIGITS)} · ${summary.count} ${summary.count === 1 ? "Stimme" : "Stimmen"}`}
            </span>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-center gap-3 pb-1">
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
            onClick={() => {
              if (!social.saved) {
                setSavedHint(true);
                setTimeout(() => setSavedHint(false), SAVED_HINT_MS);
              }
              void mark("saved", song.id, !social.saved);
            }}
          />
          <ActionButton
            label="Teilen"
            icon="share"
            title="Teilen"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}#${song.id}`;
              void share(url, song.title).then((outcome) => {
                setShared(outcome === "manual" ? url : outcome);
                setTimeout(() => setShared(null), SHARE_NOTE_MS);
              });
            }}
          />
          <ActionButton
            label={
              social.reports === 0 ? "Melden" : `Melden (${social.reports})`
            }
            icon="flag"
            title={
              social.reports === 0
                ? "Etwas stimmt nicht - melden"
                : `${social.reports} Meldung(en) ansehen oder melden`
            }
            onClick={onReport}
          />
        </div>
      </div>
      {shared === "copied" && (
        <p className="pointer-events-none absolute inset-x-6 top-1/3 z-30 rounded-2xl bg-black/75 px-4 py-3 text-center text-sm backdrop-blur">
          🔗 Link kopiert - zum Einfügen in WhatsApp, E-Mail ...
        </p>
      )}
      {shared !== null && shared !== "copied" && shared !== "shared" && (
        <div className="absolute inset-x-6 top-1/3 z-30 space-y-2 rounded-2xl bg-black/85 p-4 text-sm backdrop-blur">
          <p>Link zum Kopieren:</p>
          <input
            readOnly
            value={shared}
            onFocus={(event) => event.target.select()}
            className="w-full rounded-lg bg-zinc-800 px-2 py-1.5 text-xs"
          />
        </div>
      )}
      {savedHint && (
        <p className="pointer-events-none absolute inset-x-6 top-1/3 z-30 rounded-2xl bg-black/75 px-4 py-3 text-center text-sm backdrop-blur">
          🔖 Gemerkt - alle gemerkten Stücke findest du im <b>Archiv</b> unter{" "}
          <b>Gespeichert</b>.
        </p>
      )}
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

/** How sharing went. */
type ShareOutcome = "shared" | "copied" | "manual";

/**
 * Shares the piece's address: the device's share menu where there is one,
 * else copied to the clipboard.
 *
 * @param url - the address to share
 * @param title - the piece's title, for the share menu
 * @returns what happened - "manual" when neither worked and the visitor has
 *   to copy the address themselves
 * @remarks
 * A page opened over plain `http` - the dev server reached from a phone by
 * its network address - has neither a share menu nor the clipboard API, so
 * the old copy command is the last resort.
 */
async function share(url: string, title: string): Promise<ShareOutcome> {
  let outcome: ShareOutcome | null = null;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      outcome = "shared";
    } catch (error) {
      // Closing the menu is a choice, not a failure.
      if ((error as Error).name === "AbortError") {
        outcome = "shared";
      }
    }
  }
  if (outcome === null) {
    try {
      await navigator.clipboard.writeText(url);
      outcome = "copied";
    } catch {
      outcome = copyByCommand(url) ? "copied" : "manual";
    }
  }
  return outcome;
}

/** Copies a text the old way, which also works without `https`. */
function copyByCommand(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    // Not allowed here either.
  }
  field.remove();
  return copied;
}
