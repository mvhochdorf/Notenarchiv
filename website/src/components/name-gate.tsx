/**
 * Asks for first and last name the first time the app opens on a device.
 *
 * @module
 */
"use client";

import { useState, type ReactElement } from "react";
import { identify } from "@/lib/archive-store";
import { useHydrated } from "@/lib/browser-values";
import { MAX_NAME_PART, personId } from "@/lib/person";
import { useSettings } from "@/lib/settings";

/**
 * Renders the question over the whole app, until it is answered.
 *
 * @returns the form, or nothing once the device knows its person
 * @remarks
 * The name ties together what one musician does on phone, tablet and
 * laptop - see person.ts. Nothing is shown during the prerender, so a
 * returning visitor does not see the form flash up before their settings are
 * read.
 */
export function NameGate(): ReactElement | null {
  const hydrated = useHydrated();
  const settings = useSettings();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const named = personId(settings.firstName, settings.lastName) !== "";
  const valid = personId(firstName, lastName) !== "";

  const submit = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await identify(firstName, lastName);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  const inputClass =
    "w-full rounded-xl bg-zinc-800 px-4 py-3 outline-none focus:ring-2 focus:ring-amber-400";

  return !hydrated || named ? null : (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950 p-6">
      <form
        className="w-full max-w-sm space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) {
            void submit();
          }
        }}
      >
        <div className="space-y-2 text-center">
          <p className="text-5xl">🎼</p>
          <h1 className="text-2xl font-black">Willkommen im Notenarchiv</h1>
          <p className="text-sm text-white/60">
            Wie heißt du? Mit deinem Namen gehören deine Bewertungen, Likes und
            Kommentare auf Handy, Tablet und PC zusammen.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm text-white/70">Vorname</span>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            maxLength={MAX_NAME_PART}
            autoComplete="given-name"
            autoFocus
            className={inputClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-white/70">Nachname</span>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={MAX_NAME_PART}
            autoComplete="family-name"
            className={inputClass}
          />
        </label>
        {failed && (
          <p className="text-sm text-red-400">
            Das hat nicht geklappt - bitte prüfe die Internetverbindung und
            versuche es noch einmal.
          </p>
        )}
        <button
          type="submit"
          disabled={!valid || busy}
          className="w-full rounded-xl bg-amber-400 py-3 font-bold text-black disabled:opacity-40"
        >
          {busy ? "Einen Moment ..." : "Los geht's"}
        </button>
        <p className="text-center text-xs text-white/40">
          Bitte auf jedem Gerät genau gleich schreiben.
        </p>
      </form>
    </div>
  );
}
