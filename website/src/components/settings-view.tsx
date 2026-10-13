/**
 * The settings page: what feed and list show.
 *
 * @module
 */
"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";
import { MAX_NAME_PART, personId } from "@/lib/person";
import { identify, useArchive } from "@/lib/archive-store";
import { SONGS } from "@/lib/library";
import {
  changeSettings,
  isShown,
  SHOW_OPTIONS,
  END_OPTIONS,
  START_OPTIONS,
  useSettings,
  type AtEnd,
  type ShowFilter,
} from "@/lib/settings";
import type { SnippetStart } from "@/lib/media";
import { ClubLogo } from "./club-logo";
import { ModeNotice } from "./mode-notice";

/** The show filters in the order they are offered. */
const SHOW_ORDER: readonly ShowFilter[] = ["withMusic", "all", "withoutMusic"];

/** What happens at the end, in the order offered. */
const END_ORDER: readonly AtEnd[] = ["repeat", "next"];

/** The snippet starts in the order they are offered. */
const START_ORDER: readonly SnippetStart[] = [
  "peak",
  "middle",
  "random",
  "start",
];

/**
 * Renders the settings.
 *
 * @returns the settings page content
 */
export function SettingsView(): ReactElement {
  const archive = useArchive();
  const settings = useSettings();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-black tracking-tight">
          Einstellungen
        </h1>
        <ModeNotice mode={archive.mode} />
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold tracking-wide text-white/60 uppercase">
          Angezeigte Stücke (Play und Archiv)
        </legend>
        {SHOW_ORDER.map((show) => {
          const count = SONGS.filter((song) =>
            isShown(show, archive.media, song),
          ).length;
          return (
            <Choice
              key={show}
              name="show"
              label={SHOW_OPTIONS[show].label}
              hint={SHOW_OPTIONS[show].hint}
              count={count}
              selected={settings.show === show}
              onSelect={() => changeSettings({ show })}
            />
          );
        })}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold tracking-wide text-white/60 uppercase">
          Ausschnitt startet
        </legend>
        {START_ORDER.map((start) => (
          <Choice
            key={start}
            name="snippetStart"
            label={START_OPTIONS[start].label}
            hint={START_OPTIONS[start].hint}
            selected={settings.snippetStart === start}
            onSelect={() => changeSettings({ snippetStart: start })}
          />
        ))}
        <p className="text-xs text-white/40">
          Bei selbst verknüpften Videos gilt immer die eingetragene
          Startsekunde.
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold tracking-wide text-white/60 uppercase">
          Am Ende des Stücks
        </legend>
        {END_ORDER.map((atEnd) => (
          <Choice
            key={atEnd}
            name="atEnd"
            label={END_OPTIONS[atEnd].label}
            hint={END_OPTIONS[atEnd].hint}
            selected={settings.atEnd === atEnd}
            onSelect={() => changeSettings({ atEnd })}
          />
        ))}
      </fieldset>

      <NameSection
        // Built anew once the stored name has been read.
        key={personId(settings.firstName, settings.lastName)}
        firstName={settings.firstName}
        lastName={settings.lastName}
      />

      <Link
        href="/auswertung/"
        className="block rounded-2xl bg-white/5 p-4 font-semibold hover:bg-white/10"
      >
        📊 Auswertung
        <span className="block text-sm font-normal text-white/60">
          Bewertungen, Likes und Kommentare aller Musiker - mit Download für
          Excel.
        </span>
      </Link>

      <p className="text-xs text-white/40">
        Die Einstellungen werden nur in diesem Browser gespeichert, dein Name
        verbindet deine Bewertungen auf allen Geräten.
      </p>
    </div>
  );
}

/** One option of a setting, as a selectable card. */
function Choice({
  name,
  label,
  hint,
  count,
  selected,
  onSelect,
}: {
  readonly name: string;
  readonly label: string;
  readonly hint: string;
  readonly count?: number;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): ReactElement {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 transition-colors ${
        selected
          ? "bg-amber-400/15 ring-2 ring-amber-400"
          : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="mt-1 accent-amber-400"
      />
      <span className="flex-1">
        <span className="flex justify-between gap-2 font-semibold">
          {label}
          {count !== undefined && (
            <span className="text-white/50">{count}</span>
          )}
        </span>
        <span className="block text-sm text-white/60">{hint}</span>
      </span>
    </label>
  );
}

/** The visitor's name, changed only on purpose. */
function NameSection({
  firstName,
  lastName,
}: {
  readonly firstName: string;
  readonly lastName: string;
}): ReactElement {
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const changed =
    personId(first, last) !== personId(firstName, lastName) &&
    personId(first, last) !== "";
  const inputClass =
    "min-w-0 flex-1 rounded-2xl bg-white/5 px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400";

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-white/60 uppercase">
        <ClubLogo className="size-8" />
        Dein Name
      </legend>
      <div className="flex gap-2">
        <input
          value={first}
          onChange={(event) => setFirst(event.target.value)}
          maxLength={MAX_NAME_PART}
          aria-label="Vorname"
          placeholder="Vorname"
          className={inputClass}
        />
        <input
          value={last}
          onChange={(event) => setLast(event.target.value)}
          maxLength={MAX_NAME_PART}
          aria-label="Nachname"
          placeholder="Nachname"
          className={inputClass}
        />
      </div>
      {changed && (
        <div className="space-y-2 rounded-2xl bg-amber-400/10 p-3 text-sm">
          <p className="text-amber-200">
            Mit einem anderen Namen bist du für das Archiv eine andere Person:
            Deine bisherigen Bewertungen bleiben beim alten Namen.
          </p>
          <button
            type="button"
            onClick={() => void identify(first, last)}
            className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black"
          >
            Namen ändern
          </button>
        </div>
      )}
    </fieldset>
  );
}
