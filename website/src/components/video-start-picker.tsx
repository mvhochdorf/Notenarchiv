/**
 * A large player for choosing where a piece's snippet starts.
 *
 * @module
 */
"use client";

import { useRef, useState, type ReactElement } from "react";
import { previewUrl, type Media } from "@/lib/media";
import { command, usePlayerReports } from "./youtube-frame";

/** Seconds per minute, for `m:ss`. */
const SECONDS_PER_MINUTE = 60;

/** Digits of the seconds in `m:ss`. */
const SECOND_DIGITS = 2;

/**
 * Renders the player with the start point below it.
 *
 * @param props - the video, the chosen start second, how to change it, and
 *   its length and found peak if known
 * @returns the player and its controls
 * @remarks
 * The player opens at the chosen start. "Aktuelle Stelle als Start" takes
 * the second the video is at; a tap on the start itself jumps back to it.
 * The player is only built anew for another video, not for another start,
 * so choosing a start does not interrupt it.
 */
export function VideoStartPicker({
  media,
  start,
  onStart,
  chosen,
  youtubePeak,
  duration,
}: {
  readonly media: Media;
  /** Where the snippet starts; undefined while YouTube's is not known yet. */
  readonly start: number | undefined;
  readonly onStart: (seconds: number) => void;
  /** Whether the start was chosen rather than YouTube's highlight. */
  readonly chosen: boolean;
  /** YouTube's highlight, once the nightly job found it. */
  readonly youtubePeak: number | undefined;
  readonly duration: number | undefined;
}): ReactElement {
  const frame = useRef<HTMLIFrameElement>(null);
  const [now, setNow] = useState<number | null>(null);
  // The address the player was opened with; a new start must not reload it.
  const [src] = useState(() => previewUrl(media, start ?? 0));

  usePlayerReports(frame, (info) => {
    if (info.time !== undefined) {
      setNow(info.time);
    }
  });

  const jump = (seconds: number) => {
    if (frame.current !== null) {
      command(frame.current, "seekTo", [seconds, true]);
    }
  };

  return (
    <div className="space-y-3">
      <iframe
        ref={frame}
        src={src}
        title="Video"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full rounded-xl bg-black"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          title="Zum Start springen"
          disabled={start === undefined}
          onClick={() => start !== undefined && jump(start)}
          className="rounded-lg bg-amber-400/15 px-3 py-1.5 font-semibold text-amber-300 tabular-nums hover:bg-amber-400/25"
        >
          {start === undefined
            ? "Start: automatisch"
            : `↺ Start ${minutes(start)}${chosen ? "" : " (YouTube)"}`}
        </button>
        <button
          type="button"
          disabled={now === null}
          onClick={() => now !== null && onStart(Math.floor(now))}
          className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-black disabled:opacity-40"
        >
          ⏱ Aktuelle Stelle als Start
          {now !== null && ` (${minutes(Math.floor(now))})`}
        </button>
        <label className="flex items-center gap-1.5 text-white/60">
          Sekunde
          <input
            type="number"
            min={0}
            value={start ?? ""}
            onChange={(event) =>
              onStart(Math.max(0, Math.floor(Number(event.target.value) || 0)))
            }
            className="w-20 rounded-lg bg-zinc-800 px-2 py-1 text-white outline-none focus:ring-2 focus:ring-amber-400"
          />
        </label>
      </div>
      <p className="text-xs text-white/50">
        {duration === undefined
          ? "Länge wird über Nacht ermittelt. "
          : `Länge ${minutes(duration)}. `}
        {chosen
          ? "Play beginnt den Ausschnitt an diesem Startpunkt."
          : youtubePeak === undefined
            ? "Den Höhepunkt ermittelt der nächtliche Job bei YouTube, bis dahin startet Play in der Mitte."
            : "Play beginnt am Höhepunkt laut YouTube (am häufigsten wiederholte Stelle)."}
      </p>
    </div>
  );
}

/** Seconds as `m:ss`. */
function minutes(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${String(
    whole % SECONDS_PER_MINUTE,
  ).padStart(SECOND_DIGITS, "0")}`;
}
