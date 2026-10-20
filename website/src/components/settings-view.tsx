/**
 * The profile page: who the visitor is, what they did in the archive, and
 * their settings.
 *
 * @module
 */
"use client";

import Link from "next/link";
import { useRef, useState, type ReactElement } from "react";
import { signInAdmin, signOutAdmin, useAdmin } from "@/lib/admin";
import { identify, useArchive, type ArchiveState } from "@/lib/archive-store";
import { removeAvatar, setAvatar, useAvatar } from "@/lib/avatar";
import type { SnippetStart } from "@/lib/media";
import { displayName, MAX_NAME_PART, personId } from "@/lib/person";
import {
  changeSettings,
  END_OPTIONS,
  isShown,
  SHOW_OPTIONS,
  START_OPTIONS,
  useSettings,
  type AtEnd,
  type ShowFilter,
} from "@/lib/settings";
import { isMarked } from "@/lib/social";
import { AdminWorkspace } from "./admin-view";
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

/** The tabs below the numbers. */
type Tab = "show" | "playback" | "more" | "admin";

/** Labels of the tabs; "Verwaltung" only for a signed-in admin. */
const TAB_LABELS: Readonly<Record<Tab, string>> = {
  show: "Anzeige",
  playback: "Wiedergabe",
  more: "Mehr",
  admin: "Verwaltung",
};

/** Percent of a whole. */
const PERCENT = 100;

/**
 * Renders the profile.
 *
 * @returns the profile page content
 */
export function SettingsView(): ReactElement {
  const archive = useArchive();
  const settings = useSettings();
  const admin = useAdmin();
  const isAdmin = admin.status === "signedIn";
  const [chosen, setChosen] = useState<Tab>("show");
  // Signed out meanwhile: back to the first tab.
  const tab = chosen === "admin" && !isAdmin ? "show" : chosen;
  const tabs = (Object.keys(TAB_LABELS) as Tab[]).filter(
    (each) => each !== "admin" || isAdmin,
  );
  let content: ReactElement;

  switch (tab) {
    case "playback":
      content = (
        <>
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
        </>
      );
      break;
    case "more":
      content = (
        <>
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
          {!isAdmin && (
            <p className="rounded-2xl bg-white/5 p-4 text-sm text-white/60">
              🔧 <strong className="text-white">Verwaltung:</strong> oben beim
              Namen auf den Stift tippen und das Verwaltungs-Passwort eingeben.
              Dann erscheint hier der Reiter „Verwaltung“.
            </p>
          )}
          <p className="text-xs text-white/40">
            Einstellungen und Profilbild werden nur in diesem Browser
            gespeichert, dein Name verbindet deine Bewertungen auf allen
            Geräten.
          </p>
        </>
      );
      break;
    default:
      content = (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold tracking-wide text-white/60 uppercase">
            Angezeigte Stücke (Play und Archiv)
          </legend>
          {SHOW_ORDER.map((show) => (
            <Choice
              key={show}
              name="show"
              label={SHOW_OPTIONS[show].label}
              hint={SHOW_OPTIONS[show].hint}
              count={
                archive.songs.filter((song) => isShown(show, archive, song))
                  .length
              }
              selected={settings.show === show}
              onSelect={() => changeSettings({ show })}
            />
          ))}
        </fieldset>
      );
  }

  // The admin's lists alone, as wide as the evaluation: nothing else of
  // the profile in the way.
  return tab === "admin" ? (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setChosen("show")}
          className="rounded-xl bg-zinc-800 px-3 py-1.5 text-sm"
        >
          ‹ Profil
        </button>
        <h1 className="text-2xl font-black tracking-tight">Verwaltung</h1>
      </div>
      <AdminWorkspace />
    </div>
  ) : (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
      <ProfileHeader
        // Built anew once the stored name has been read.
        key={personId(settings.firstName, settings.lastName)}
        firstName={settings.firstName}
        lastName={settings.lastName}
      />
      <ModeNotice mode={archive.mode} />
      <Numbers archive={archive} show={settings.show} />

      <nav className="flex border-b border-white/10" aria-label="Bereich">
        {tabs.map((each) => (
          <button
            key={each}
            type="button"
            aria-current={tab === each ? "page" : undefined}
            onClick={() => setChosen(each)}
            className={`relative flex-1 pb-2.5 text-sm font-semibold ${
              tab === each
                ? "text-white after:absolute after:inset-x-6 after:bottom-0 after:h-0.5 after:rounded after:bg-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {TAB_LABELS[each]}
          </button>
        ))}
      </nav>

      <div className="space-y-6">{content}</div>
    </div>
  );
}

/** The visitor's name with a pencil to change it, and their picture. */
function ProfileHeader({
  firstName,
  lastName,
}: {
  readonly firstName: string;
  readonly lastName: string;
}): ReactElement {
  const admin = useAdmin();
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = personId(first, last) !== "";
  const changed =
    valid && personId(first, last) !== personId(firstName, lastName);

  const close = () => {
    setFirst(firstName);
    setLast(lastName);
    setPassword("");
    setError("");
    setEditing(false);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    if (changed) {
      await identify(first, last);
    }
    const failure = password === "" ? null : await signInAdmin(password);
    setBusy(false);
    if (failure === null) {
      setPassword("");
      setEditing(false);
    } else {
      setError(failure);
    }
  };
  const inputClass =
    "min-w-0 flex-1 rounded-2xl bg-white/5 px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={first}
                onChange={(event) => setFirst(event.target.value)}
                maxLength={MAX_NAME_PART}
                aria-label="Vorname"
                placeholder="Vorname"
                className={inputClass}
                autoFocus
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
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-black tracking-tight">
                {displayName(firstName, lastName) || "Ohne Namen"}
              </h1>
              {admin.status === "signedIn" && (
                <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  🔧 Verwaltung
                </span>
              )}
              <button
                type="button"
                aria-label="Namen ändern"
                onClick={() => setEditing(true)}
                className="shrink-0 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <PencilIcon />
              </button>
            </div>
          )}
        </div>
        <Avatar name={displayName(firstName, lastName)} />
      </div>

      {editing && (
        <div className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm">
          {changed && (
            <p className="text-amber-200">
              Mit einem anderen Namen bist du für das Archiv eine andere Person:
              Deine bisherigen Bewertungen bleiben beim alten Namen.
            </p>
          )}
          {admin.status === "signedIn" ? (
            <p className="flex items-center gap-2 text-white/70">
              🔧 Als Verwaltung angemeldet.
              <button
                type="button"
                onClick={() => void signOutAdmin()}
                className="text-amber-300 underline"
              >
                Abmelden
              </button>
            </p>
          ) : (
            admin.status !== "unavailable" && (
              <label className="block space-y-1">
                <span className="text-white/60">
                  Verwaltungs-Passwort - nur für Verwalter, sonst leer lassen
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Passwort"
                  className="w-full rounded-xl bg-zinc-800 px-4 py-2.5 outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>
            )
          )}
          {admin.status === "denied" && (
            <p className="text-amber-200">
              Angemeldet, aber noch nicht als Verwaltung eingetragen
              (docs/verwaltung.md):{" "}
              <span className="font-mono break-all select-all">
                {admin.uid}
              </span>
            </p>
          )}
          {error !== "" && <p className="text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || (!changed && password === "")}
              onClick={() => void save()}
              className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-40"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-xl bg-zinc-800 px-4 py-2"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The round picture: tap to choose one, kept on this device only. */
function Avatar({ name }: { readonly name: string }): ReactElement {
  const picture = useAvatar();
  const picker = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        aria-label="Profilbild wählen"
        onClick={() => picker.current?.click()}
        className="relative size-20 overflow-hidden rounded-full bg-gradient-to-br from-amber-400 to-rose-500 ring-2 ring-white/20"
      >
        {picture === null ? (
          <span className="text-2xl font-black text-white">
            {initials || "?"}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL from this device
          <img src={picture} alt="" className="size-full object-cover" />
        )}
        <span className="absolute right-0 bottom-0 left-0 bg-black/50 py-0.5 text-[10px] font-semibold">
          ändern
        </span>
      </button>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) {
            void setAvatar(file).then((done) => setFailed(!done));
          }
        }}
      />
      {picture !== null && (
        <button
          type="button"
          onClick={removeAvatar}
          className="text-xs text-white/40 hover:text-white/70"
        >
          entfernen
        </button>
      )}
      {failed && (
        <span className="text-xs text-red-400">Bild nicht lesbar</span>
      )}
    </div>
  );
}

/**
 * How much of the archive the visitor saw, rated and liked.
 *
 * @remarks
 * Counted among the pieces chosen under "Angezeigte Stücke", so the percent
 * says how much of what Play and the archive show is done.
 */
function Numbers({
  archive,
  show,
}: {
  readonly archive: ArchiveState;
  readonly show: ShowFilter;
}): ReactElement {
  const shown = archive.songs.filter((song) => isShown(show, archive, song));
  const total = shown.length;
  const count = (test: (songId: string) => boolean) =>
    shown.filter((song) => test(song.id)).length;
  const rows = [
    {
      icon: "👁",
      label: "Angesehen",
      value: count((id) => isMarked(archive.views, id, archive.me)),
      ofAll: true,
    },
    {
      icon: "⭐",
      label: "Bewertet",
      value: count((id) => archive.mine[id] !== undefined),
    },
    {
      icon: "❤️",
      label: "Likes",
      value: count((id) => isMarked(archive.likes, id, archive.me)),
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-2xl bg-white/5 px-2 py-3 text-center"
        >
          <p className="text-2xl font-black tabular-nums">
            {row.value}
            {"ofAll" in row && (
              <span className="text-sm font-semibold text-white/50">
                {" "}
                / {total}
              </span>
            )}
          </p>
          <p className="text-xs text-white/60">
            {row.icon} {row.label}
          </p>
          <p className="mt-1 text-xs font-semibold text-amber-300 tabular-nums">
            {total === 0 ? 0 : Math.round((row.value / total) * PERCENT)} %
          </p>
        </div>
      ))}
    </div>
  );
}

/** A pencil, for changing the name. */
function PencilIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
    </svg>
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
