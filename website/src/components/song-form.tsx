/**
 * The form for one piece: its fields and its video - on the admin page and
 * on the page for adding a piece.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import {
  entryOf,
  MAX_FIELD_LENGTH,
  newSongId,
  SONG_FIELDS,
  type Catalog,
  type CatalogEntry,
  type SongField,
} from "@/lib/catalog";
import { categories, filterSongs, NO_FILTER } from "@/lib/library";
import {
  parseYouTube,
  searchUrl,
  thumbnailUrl,
  type FixedMedia,
  type Media,
} from "@/lib/media";
import type { Song } from "@/lib/song";

/** Label of each field, as the club's list calls them. */
const FIELD_LABELS: Readonly<Record<SongField, string>> = {
  number: "Nummer",
  title: "Titel *",
  genre: "Sparte",
  occasion: "Anlass",
  solo: "Solo",
  composer: "Komponist",
  arranger: "Bearbeitung",
  publisher: "Verlag",
  folderNumber: "Nr. im Ordner",
  collection: "Sammlung/Heft",
};

/** Fields offered with the values already in use. */
const LISTED_FIELDS: ReadonlySet<SongField> = new Set(["genre", "occasion"]);

/** Seconds per minute, for showing lengths. */
const SECONDS_PER_MINUTE = 60;

/** Digits of the seconds in `m:ss`. */
const SECOND_DIGITS = 2;

/** Shortest title worth looking for similar pieces. */
const MIN_SIMILAR_QUERY = 3;

/** Most similar pieces named while typing a new title. */
const MAX_SIMILAR = 3;

/** What the form does with a piece once it is filled in. */
export type SongFormActions = {
  /**
   * Stores the piece; throws when the database refuses.
   *
   * @param id - the piece's id, new or kept
   * @param entry - all its fields
   * @param replacesLink - whether a musician's own link is taken over
   */
  readonly save: (
    id: string,
    entry: CatalogEntry,
    replacesLink: boolean,
  ) => Promise<void>;
  /** Deletes the piece; left out where deleting is not allowed. */
  readonly remove?: (id: string) => Promise<void>;
  /** Called once the piece is stored or deleted. */
  readonly onDone: (song: Song) => void;
  /** Leaves the form without saving; left out where there is no way back. */
  readonly onCancel?: () => void;
};

/**
 * Renders the form.
 *
 * @param props - the piece (null for a new one), the catalog, the video a
 *   musician linked in the app if any, what to do with the result and what
 *   to say when the database refuses
 * @returns the form
 */
export function SongForm({
  song,
  catalog,
  linked,
  actions,
  refused,
}: {
  readonly song: Song | null;
  readonly catalog: Catalog;
  readonly linked: Media | undefined;
  readonly actions: SongFormActions;
  readonly refused: string;
}): ReactElement {
  const stored = song === null ? undefined : catalog.videos[song.id];
  // What the piece plays now: a musician's link wins over the catalog's.
  const current = linked ?? stored;
  const [fields, setFields] = useState<Record<SongField, string>>(
    () =>
      Object.fromEntries(
        SONG_FIELDS.map((field) => [field, song?.[field] ?? ""]),
      ) as Record<SongField, string>,
  );
  const [link, setLink] = useState(
    current === undefined ? "" : `https://youtu.be/${current.videoId}`,
  );
  const [start, setStart] = useState(String(current?.start ?? 0));
  const [noVideo, setNoVideo] = useState(
    song !== null && catalog.noVideo.has(song.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const parsed = link.trim() === "" ? null : parseYouTube(link);
  const linkInvalid = link.trim() !== "" && parsed === null;
  const title = fields.title.trim();
  const video: FixedMedia | undefined =
    parsed === null
      ? undefined
      : {
          // Length and peak found by the search stay with the same video.
          ...(stored?.videoId === parsed.videoId ? stored : {}),
          videoId: parsed.videoId,
          start: Math.max(0, Math.floor(Number(start) || 0)),
        };

  const changeLink = (value: string) => {
    setLink(value);
    const media = parseYouTube(value);
    if (media !== null && media.start > 0) {
      setStart(String(media.start));
    }
  };

  const save = async () => {
    setBusy(true);
    setError("");
    const text = (field: SongField) => fields[field].trim() || null;
    const id =
      song?.id ??
      newSongId(
        text("number"),
        title,
        new Set(catalog.songs.map((each) => each.id)),
      );
    const changed: Song = {
      id,
      number: text("number"),
      title,
      genre: text("genre"),
      occasion: text("occasion"),
      solo: text("solo"),
      composer: text("composer"),
      arranger: text("arranger"),
      publisher: text("publisher"),
      folderNumber: text("folderNumber"),
      collection: text("collection"),
      ...(song?.added === undefined ? {} : { added: song.added }),
      ...(song?.addedBy === undefined ? {} : { addedBy: song.addedBy }),
    };
    try {
      // The form showed the musician's link; what is saved replaces it.
      await actions.save(
        id,
        entryOf(changed, video, noVideo),
        linked !== undefined,
      );
      actions.onDone(changed);
    } catch {
      setError(refused);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (
      song !== null &&
      actions.remove !== undefined &&
      window.confirm(
        `"${song.title}" wirklich löschen? Bewertungen und Kommentare bleiben in der Datenbank, sind aber nicht mehr zu sehen.`,
      )
    ) {
      setBusy(true);
      try {
        await actions.remove(song.id);
        actions.onDone(song);
      } catch {
        setError(refused);
        setBusy(false);
      }
    }
  };

  const inputClass =
    "w-full rounded-xl bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400";

  // While a new title is typed: the pieces it may already be.
  const similar =
    song === null && title.length >= MIN_SIMILAR_QUERY
      ? filterSongs(catalog.songs, { ...NO_FILTER, query: title }).slice(
          0,
          MAX_SIMILAR,
        )
      : [];

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SONG_FIELDS.map((field) => (
          <label
            key={field}
            className={`block space-y-1 ${field === "title" ? "sm:col-span-2" : ""}`}
          >
            <span className="text-sm text-white/70">{FIELD_LABELS[field]}</span>
            <input
              value={fields[field]}
              onChange={(event) =>
                setFields({ ...fields, [field]: event.target.value })
              }
              maxLength={MAX_FIELD_LENGTH}
              list={LISTED_FIELDS.has(field) ? `values-${field}` : undefined}
              required={field === "title"}
              className={inputClass}
            />
            {field === "title" && similar.length > 0 && (
              <span className="block rounded-xl bg-amber-400/10 p-3 text-sm">
                <span className="block text-amber-200">Gibt es das schon?</span>
                {similar.map((each) => (
                  <span key={each.id} className="block text-white/70">
                    {[each.number, each.title, each.composer]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ))}
              </span>
            )}
          </label>
        ))}
      </div>
      {[...LISTED_FIELDS].map((field) => (
        <datalist key={field} id={`values-${field}`}>
          {categories(catalog.songs, field as "genre" | "occasion").map(
            (category) => (
              <option key={category.name} value={category.name} />
            ),
          )}
        </datalist>
      ))}

      <fieldset className="space-y-3 rounded-2xl bg-white/5 p-4">
        <legend className="px-1 text-sm font-semibold text-white/70">
          Video
        </legend>
        {linked !== undefined && (
          <p className="text-sm text-amber-200">
            Ein Musiker hat dieses Video in der App verknüpft. Beim Speichern
            wird es fest übernommen.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => changeLink(event.target.value)}
            placeholder="YouTube-Link, z. B. https://youtu.be/..."
            aria-label="YouTube-Link"
            className={`${inputClass} min-w-0 flex-1`}
          />
          <a
            href={searchUrl(
              [title, fields.composer, "Blasmusik"].filter(Boolean).join(" "),
            )}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-red-600 px-3 py-2 font-semibold hover:bg-red-500"
          >
            Suchen ↗
          </a>
        </div>
        {linkInvalid && (
          <p className="text-sm text-red-400">
            Das ist kein YouTube-Video-Link.
          </p>
        )}
        {video !== undefined && (
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimization */}
            <img src={thumbnailUrl(video)} alt="" className="h-20 rounded-lg" />
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                Ausschnitt frühestens ab Sekunde
                <input
                  type="number"
                  min={0}
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  className="w-20 rounded-lg bg-zinc-800 px-2 py-1 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
              <p className="text-white/50">
                {video.duration === undefined
                  ? "Länge und Höhepunkt werden über Nacht ermittelt."
                  : `Länge ${minutes(video.duration)}${
                      video.peak === undefined || video.peak === null
                        ? ""
                        : ` · Höhepunkt bei ${minutes(video.peak)}`
                    }`}
              </p>
            </div>
          </div>
        )}
        {video === undefined && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noVideo}
              onChange={(event) => setNoVideo(event.target.checked)}
              className="accent-amber-400"
            />
            Es gibt kein passendes Video (die automatische Suche lässt das Stück
            dann aus)
          </label>
        )}
      </fieldset>

      {error !== "" && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="submit"
          disabled={busy || title === "" || linkInvalid}
          className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-40"
        >
          Speichern
        </button>
        {actions.onCancel !== undefined && (
          <button
            type="button"
            onClick={actions.onCancel}
            className="rounded-xl bg-zinc-800 px-4 py-2"
          >
            Abbrechen
          </button>
        )}
        {song !== null && actions.remove !== undefined && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="ml-auto rounded-xl px-4 py-2 text-red-400 hover:bg-red-950 disabled:opacity-40"
          >
            Löschen
          </button>
        )}
      </div>
    </form>
  );
}

/** Seconds as `m:ss`. */
function minutes(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${String(
    whole % SECONDS_PER_MINUTE,
  ).padStart(SECOND_DIGITS, "0")}`;
}
