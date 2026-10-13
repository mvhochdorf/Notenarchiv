/**
 * The visitor's settings, kept in this browser.
 *
 * @module
 */
import { useSyncExternalStore } from "react";
import { readStored, storageKey, writeStored } from "./local-store";
import { mediaFor, type Media, type SnippetStart } from "./media";
import type { Song } from "./song";

/** Which pieces feed and list show. */
export type ShowFilter = "withMusic" | "all" | "withoutMusic";

/** Labels and explanations of the show filters, for the settings page. */
export const SHOW_OPTIONS: Readonly<
  Record<ShowFilter, { readonly label: string; readonly hint: string }>
> = {
  withMusic: {
    label: "Nur Stücke mit Musik",
    hint: "Zeigt nur Stücke, zu denen ein Video verknüpft ist.",
  },
  all: {
    label: "Alle Stücke",
    hint: "Das ganze Archiv, auch Stücke ohne Video.",
  },
  withoutMusic: {
    label: "Nur Stücke ohne Musik",
    hint: "Zum Nachtragen: Stücke, denen noch ein Video fehlt.",
  },
};

/** Labels and explanations of the snippet starts, for the settings page. */
export const START_OPTIONS: Readonly<
  Record<SnippetStart, { readonly label: string; readonly hint: string }>
> = {
  peak: {
    label: "Höhepunkt",
    hint: "Die meistgesehene Stelle des Videos - meist der schönste Teil, ohne Ansage und Applaus. Ohne diese Angabe aus der Mitte.",
  },
  middle: {
    label: "Aus der Mitte",
    hint: "Startet in der Mitte des Stücks.",
  },
  random: {
    label: "Zufällige Stelle",
    hint: "Jedes Mal eine andere Stelle.",
  },
  start: {
    label: "Vom Anfang",
    hint: "Startet am Anfang des Videos.",
  },
};

/** What happens when a piece has played to its end. */
export type AtEnd = "repeat" | "next";

/** Labels and explanations of what happens at the end. */
export const END_OPTIONS: Readonly<
  Record<AtEnd, { readonly label: string; readonly hint: string }>
> = {
  repeat: {
    label: "Von vorne wiederholen",
    hint: "Das Stück beginnt wieder am Anfang.",
  },
  next: {
    label: "Nächstes Stück",
    hint: "Play wechselt von selbst zum nächsten Stück.",
  },
};

/** Everything that can be set. */
export type Settings = {
  readonly show: ShowFilter;
  readonly snippetStart: SnippetStart;
  readonly atEnd: AtEnd;
  /** The visitor's name, asked for once per device; see person.ts. */
  readonly firstName: string;
  readonly lastName: string;
};

/** What a new visitor gets. */
const DEFAULTS: Settings = {
  show: "withMusic",
  snippetStart: "peak",
  atEnd: "repeat",
  firstName: "",
  lastName: "",
};

/** Schema version of the stored entry - raise it on breaking changes. */
const SETTINGS_VERSION = 1;

/** Where the settings are kept. */
const SETTINGS_KEY = storageKey("settings");

let current: Settings | null = null;
const listeners = new Set<() => void>();

/**
 * Subscribes a component to the settings.
 *
 * @returns the current settings; the defaults during the prerender
 */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, loaded, () => DEFAULTS);
}

/**
 * Changes some settings and keeps them for the next visit.
 *
 * @param change - the settings to change
 */
export function changeSettings(change: Partial<Settings>): void {
  current = { ...loaded(), ...change };
  writeStored(SETTINGS_KEY, SETTINGS_VERSION, current);
  listeners.forEach((listener) => listener());
}

/**
 * Whether a piece is shown under a filter.
 *
 * @param show - the filter
 * @param linked - the links musicians made in the app
 * @param song - the piece
 * @returns true if feed and list should show it
 */
export function isShown(
  show: ShowFilter,
  linked: Readonly<Record<string, Media>>,
  song: Song,
): boolean {
  const hasMusic = mediaFor(linked, song.id) !== undefined;
  let shown: boolean;
  switch (show) {
    case "withMusic":
      shown = hasMusic;
      break;
    case "withoutMusic":
      shown = !hasMusic;
      break;
    default:
      shown = true;
  }
  return shown;
}

/**
 * The settings outside of React.
 *
 * @returns the current settings
 */
export function currentSettings(): Settings {
  return loaded();
}

/** The settings, read from storage on first use. */
function loaded(): Settings {
  current ??= {
    ...DEFAULTS,
    ...readStored(SETTINGS_KEY, SETTINGS_VERSION, isSettings),
  };
  return current;
}

/** Adds a listener. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether a stored value has the shape of the settings. */
function isSettings(value: unknown): value is Settings {
  const settings = value as Settings | null;
  return (
    typeof settings === "object" &&
    settings !== null &&
    typeof settings.show === "string" &&
    settings.show in SHOW_OPTIONS &&
    (settings.snippetStart === undefined ||
      settings.snippetStart in START_OPTIONS) &&
    (settings.atEnd === undefined || settings.atEnd in END_OPTIONS) &&
    (settings.firstName === undefined ||
      typeof settings.firstName === "string") &&
    (settings.lastName === undefined || typeof settings.lastName === "string")
  );
}
