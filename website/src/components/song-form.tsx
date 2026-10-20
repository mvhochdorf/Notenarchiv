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
  snippetStart,
  type FixedMedia,
  type Media,
} from "@/lib/media";
import type { Song } from "@/lib/song";
import { VideoStartPicker } from "./video-start-picker";

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

/** The fields always shown; the others wait under "Weitere Daten". */
const MAIN_FIELDS: readonly SongField[] = [
  "number",
  "title",
  "composer",
  "arranger",
];

/** The fields shown once "Weitere Daten" is opened. */
const MORE_FIELDS: readonly SongField[] = SONG_FIELDS.filter(
  (field) => !MAIN_FIELDS.includes(field),
);

/** Fields offered with the values already in use. */
const LISTED_FIELDS: ReadonlySet<SongField> = new Set(["genre", "occasion"]);

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
  // A start somebody chose, rather than YouTube's highlight: one that
  // differs from it, or a musician's own link.
  const [startChosen, setStartChosen] = useState(
    current !== undefined &&
      (stored === undefined
        ? current.start > 0
        : typeof stored.peak === "number" &&
          stored.youtubePeak !== undefined &&
          stored.peak !== stored.youtubePeak),
  );
  // The chosen start; while none is chosen, where the snippet starts now.
  const [start, setStart] = useState(() =>
    current === undefined ? 0 : snippetStart(current, "peak", 0),
  );
  const chooseStart = (seconds: number) => {
    setStart(seconds);
    setStartChosen(true);
  };
  const [noVideo, setNoVideo] = useState(
    song !== null && catalog.noVideo.has(song.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Open from the start when a piece already has some of these filled in.
  const [moreOpen, setMoreOpen] = useState(() =>
    MORE_FIELDS.some((field) => (song?.[field] ?? "") !== ""),
  );

  const parsed = link.trim() === "" ? null : parseYouTube(link);
  const linkInvalid = link.trim() !== "" && parsed === null;
  const title = fields.title.trim();
  // The same video keeps what is known about it: length, label, start.
  const known = stored?.videoId === parsed?.videoId ? stored : undefined;
  // YouTube's highlight; videos described before it was kept apart have it
  // as their peak.
  const youtubePeak =
    known?.youtubePeak ??
    (known?.youtubePeak === undefined && typeof known?.peak === "number"
      ? known.peak
      : undefined);
  const video: FixedMedia | undefined =
    parsed === null
      ? undefined
      : {
          ...known,
          videoId: parsed.videoId,
          // A chosen start is the snippet's start: Play's "Höhepunkt" begins
          // there, and no other start goes before it.
          ...(startChosen
            ? {
                start: Math.min(known?.start ?? parsed.start, start),
                peak: start,
              }
            : {
                start: known?.start ?? parsed.start,
                // Back to YouTube's highlight, or none until the job finds it.
                peak: youtubePeak,
              }),
        };

  const changeLink = (value: string) => {
    setLink(value);
    const media = parseYouTube(value);
    if (media !== null && media.start > 0) {
      chooseStart(media.start);
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

  /** One field with its label. */
  const input = (field: SongField) => (
    <label key={field} className="block space-y-1">
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
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">{MAIN_FIELDS.map(input)}</div>
      <details
        open={moreOpen}
        onToggle={(event) => setMoreOpen(event.currentTarget.open)}
        className="rounded-2xl bg-white/5"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-white/70 select-none">
          Weitere Daten
          <span className="font-normal text-white/40">
            {" "}
            - Sparte, Anlass, Solo, Verlag, Nr. im Ordner, Sammlung
          </span>
        </summary>
        <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
          {MORE_FIELDS.map(input)}
        </div>
      </details>
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
          <VideoStartPicker
            // A fresh player for another video.
            key={video.videoId}
            media={video}
            start={startChosen ? start : youtubePeak}
            onStart={chooseStart}
            chosen={startChosen}
            youtubePeak={youtubePeak}
            duration={video.duration}
          />
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
