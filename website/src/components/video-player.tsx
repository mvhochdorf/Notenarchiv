/**
 * Plays a linked YouTube video with the page's own timeline.
 *
 * @module
 */
"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  embedUrl,
  needsSeek,
  snippetStart,
  thumbnailUrl,
  type FixedMedia,
} from "@/lib/media";
import { useSettings } from "@/lib/settings";
import { command, YouTubeFrame, type PlayerInfo } from "./youtube-frame";

/** How long a press has to last to count as holding. */
const HOLD_MS = 350;

/** Playback speed while the video is held. */
const FAST_RATE = 2;

/**
 * Speed of a player that is not on screen.
 *
 * @remarks
 * A paused player told to play shows YouTube's own button for a few seconds
 * (see {@link VideoPlayer}). So a player off screen - loaded ahead, or left
 * behind by swiping on - keeps playing instead: silent and at a quarter of
 * the speed. Coming on screen only speeds it up and turns the sound on,
 * which shows nothing.
 */
const WAITING_RATE = 0.25;

/** How far a player loaded ahead may run past its start before it reloads. */
const MAX_DRIFT_S = 3;

/** How long a video may take to start before its sound counts as blocked. */
const SOUND_CHECK_MS = 2500;

/** Longest pause between the two taps of a double tap. */
const DOUBLE_TAP_MS = 280;

/** How long the heart of a double tap stays on screen. */
const HEART_MS = 800;

/** How long the timeline waits for the finger to stop before jumping. */
const SEEK_DELAY_MS = 300;

/** Seconds per minute, for the time display. */
const SECONDS_PER_MINUTE = 60;

/** Digits of the seconds in the time display. */
const SECOND_DIGITS = 2;

/** States the YouTube player reports. */
const PLAYER = {
  ended: 0,
  playing: 1,
} as const;

/** What the player last reported. */
type Report = {
  /** YouTube's player state, -1 before anything happened. */
  readonly state: number;
  readonly time: number;
  readonly duration: number;
  /** Whether the current player has played at all yet. */
  readonly started: boolean;
};

/** The embedded player: its address, and a key that changes on reload. */
type Player = {
  readonly key: number;
  readonly src: string;
};

/** A heart popping up where the video was double tapped. */
type Heart = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
};

/**
 * Renders the player and its timeline.
 *
 * @param props - the video, whether this card is on screen, whether the
 *   sound is off, the piece's title, and what happens at the end, on the
 *   first tap while silent, when sound is blocked, and on a double tap
 * @returns the player filling its card, and the timeline at the bottom
 * @remarks
 * The video starts where the visitor's settings say (beginning, middle,
 * random or the most watched part) and plays to its end; then it starts over
 * or the feed moves on, as set.
 *
 * YouTube shows its own play and pause button in the middle of the player
 * for a few seconds whenever playback starts, resumes or jumps; the frame is
 * placed so that this middle lies just off the card (see youtube-frame.tsx).
 * Starting over is left to YouTube's own loop, and a player off screen
 * keeps running slowly and silently rather than waiting paused.
 *
 * Until the video really plays its still image covers the player. A layer
 * above the frame takes the taps: a tap pauses (a faint play symbol shows it
 * can go on) and resumes - or, while the video is still silent, switches the
 * sound on -, a double tap likes the piece, and holding plays at double
 * speed until released.
 */
export function VideoPlayer({
  media,
  active,
  muted,
  title,
  onEnded,
  onUnmute,
  onSoundBlocked,
  onDoubleTap,
}: {
  readonly media: FixedMedia;
  /** Whether this is the card on screen; the others wait, loaded ahead. */
  readonly active: boolean;
  readonly muted: boolean;
  readonly title: string;
  readonly onEnded: () => void;
  readonly onUnmute: () => void;
  /** Called when the browser refuses to play with sound before a touch. */
  readonly onSoundBlocked: () => void;
  readonly onDoubleTap: () => void;
}): ReactElement {
  const { snippetStart: mode, atEnd } = useSettings();
  const loop = atEnd === "repeat";
  // Fixed when the player appears; later changes go by message or reload.
  const [plan] = useState(() => {
    const random = Math.random();
    const seek = needsSeek(media, mode);
    const start = seek ? media.start : snippetStart(media, mode, random);
    return {
      start,
      startFor: seek
        ? (duration: number) =>
            snippetStart({ ...media, duration }, mode, random)
        : null,
    };
  });
  const [player, setPlayer] = useState<Player>(() => ({
    key: 0,
    // A player loaded ahead always starts silent, see WAITING_RATE.
    src: embedUrl(media, active ? muted : true, plan.start, loop),
  }));
  const [report, setReport] = useState<Report>({
    state: -1,
    time: 0,
    duration: media.duration ?? 0,
    started: false,
  });
  const [fast, setFast] = useState(false);
  const [hearts, setHearts] = useState<readonly Heart[]>([]);
  // The frame, for sending commands.
  const frame = useRef<HTMLIFrameElement | null>(null);
  // Read and written per message, which may come faster than renders.
  const lastState = useRef(-1);
  const slowed = useRef(false);
  const jumped = useRef(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seekTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef(0);
  const held = useRef(false);

  /** Sends a command to the player. */
  const steer = (func: string, args: readonly unknown[] = []) => {
    if (frame.current !== null) {
      command(frame.current, func, args);
    }
  };

  /** Loads the player anew, starting by itself at a second. */
  const reload = (at: number, silent: boolean) => {
    lastState.current = -1;
    slowed.current = false;
    setReport((previous) => ({ ...previous, time: at, started: false }));
    setPlayer((previous) => ({
      key: previous.key + 1,
      src: embedUrl(media, silent, Math.round(at), loop),
    }));
  };

  /** Whether the visitor is moving the timeline right now. */
  const seeking = () => seekTimer.current !== undefined;

  /** What the player reported. */
  const onInfo = (info: PlayerInfo) => {
    const state = info.state ?? lastState.current;
    const duration = info.duration ?? 0;
    if (
      plan.startFor !== null &&
      !jumped.current &&
      duration > 0 &&
      state === PLAYER.playing
    ) {
      jumped.current = true;
      reload(plan.startFor(duration), active ? muted : true);
    }
    if (!active && state === PLAYER.playing) {
      if (!slowed.current) {
        slowed.current = true;
        steer("setPlaybackRate", [WAITING_RATE]);
        steer("mute");
      }
      if (!report.started && (info.time ?? 0) - plan.start > MAX_DRIFT_S) {
        // A player loaded ahead ran too far while nobody watched.
        reload(plan.start, true);
      }
    }
    if (
      active &&
      state === PLAYER.ended &&
      lastState.current !== PLAYER.ended
    ) {
      // Only without the loop: then the feed moves on.
      onEnded();
    }
    lastState.current = state;
    setReport((previous) => ({
      state,
      duration: info.duration ?? previous.duration,
      time: seeking() ? previous.time : (info.time ?? previous.time),
      started: previous.started || state === PLAYER.playing,
    }));
  };

  // A browser that allows no sound before the first touch does not start a
  // video with sound at all; it then starts anew, silent, until a touch.
  const checkSound = useEffectEvent(() => {
    if (active && !muted && lastState.current !== PLAYER.playing) {
      reload(plan.start, true);
      onSoundBlocked();
    }
  });
  useEffect(() => {
    const timer = setTimeout(checkSound, SOUND_CHECK_MS);
    return () => clearTimeout(timer);
  }, []);

  const onMuted = useEffectEvent((isMuted: boolean) => {
    // Players off screen stay silent until their card comes on screen.
    if (active) {
      steer(isMuted ? "mute" : "unMute");
    }
  });
  useEffect(() => {
    onMuted(muted);
  }, [muted]);

  // Coming on screen speeds the player up and gives it its sound; leaving
  // the screen slows it down and silences it. Neither shows YouTube's button.
  const onActive = useEffectEvent((isActive: boolean) => {
    if (isActive) {
      steer("setPlaybackRate", [1]);
      steer(muted ? "mute" : "unMute");
    } else {
      setFast(false);
      steer("setPlaybackRate", [WAITING_RATE]);
      steer("mute");
    }
  });
  const firstActive = useRef(active);
  useEffect(() => {
    if (active !== firstActive.current) {
      firstActive.current = active;
      onActive(active);
    }
  }, [active]);

  const playing = report.state === PLAYER.playing;

  // Hold: double speed until released.
  const onPress = () => {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      if (playing) {
        setFast(true);
        steer("setPlaybackRate", [FAST_RATE]);
      }
    }, HOLD_MS);
  };
  const onRelease = () => {
    clearTimeout(holdTimer.current);
    if (held.current && fast) {
      setFast(false);
      steer("setPlaybackRate", [1]);
    }
  };
  // A single tap waits a moment, in case a second one makes it a double tap.
  const singleTap = () => {
    if (muted) {
      // The browser started the video silently; the first tap asks for sound.
      onUnmute();
    } else if (playing) {
      steer("pauseVideo");
    } else if (report.started) {
      steer("playVideo");
    }
  };
  const onTap = (x: number, y: number) => {
    const now = Date.now();
    if (held.current) {
      // The end of a hold, not a tap.
      held.current = false;
    } else if (now - lastTap.current < DOUBLE_TAP_MS) {
      clearTimeout(tapTimer.current);
      lastTap.current = 0;
      onDoubleTap();
      const heart = { id: now, x, y };
      setHearts((shown) => [...shown, heart]);
      setTimeout(
        () => setHearts((shown) => shown.filter((other) => other !== heart)),
        HEART_MS,
      );
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(singleTap, DOUBLE_TAP_MS);
    }
  };

  // The timeline follows the finger at once; the video jumps when it stops.
  const seek = (seconds: number) => {
    setReport((previous) => ({ ...previous, time: seconds }));
    clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => {
      seekTimer.current = undefined;
      steer("seekTo", [seconds, true]);
    }, SEEK_DELAY_MS);
  };

  return (
    <>
      <div
        className="absolute inset-0 overflow-hidden bg-black"
        style={{ containerType: "size" }}
      >
        <YouTubeFrame
          key={player.key}
          src={player.src}
          title={title}
          onInfo={onInfo}
          onFrame={(element) => {
            frame.current = element;
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- a remote still; a static export has no image optimizer */}
        <img
          src={thumbnailUrl(media)}
          alt=""
          className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-300 ${
            report.started ? "opacity-0" : "opacity-100"
          }`}
        />
        <div
          role="button"
          tabIndex={0}
          data-video-tap
          aria-label={
            muted ? "Ton einschalten" : playing ? "Anhalten" : "Weiterspielen"
          }
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            onTap(event.clientX - box.left, event.clientY - box.top);
          }}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              singleTap();
            }
          }}
          onPointerDown={onPress}
          onPointerUp={onRelease}
          onPointerCancel={onRelease}
          onPointerLeave={onRelease}
          onContextMenu={(event) => event.preventDefault()}
          className="absolute inset-0 flex items-center justify-center select-none [-webkit-touch-callout:none]"
        >
          {report.started && !playing && !fast && (
            <span className="text-8xl text-white/60 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
              ▶
            </span>
          )}
          {!report.started && (
            <span className="size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          )}
          {hearts.map((heart) => (
            <span
              key={heart.id}
              className="animate-heart-pop pointer-events-none absolute text-8xl text-rose-500 drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
              style={{ left: heart.x, top: heart.y }}
            >
              ♥
            </span>
          ))}
          {active && muted && report.started && (
            <span className="absolute top-36 rounded-full bg-black/50 px-3 py-1.5 text-sm font-semibold backdrop-blur">
              🔇 Tippen für Ton
            </span>
          )}
          {fast && (
            <span className="absolute top-36 rounded-full bg-black/50 px-3 py-1 text-sm font-semibold backdrop-blur">
              2× ▶▶
            </span>
          )}
        </div>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 px-4 pb-3 text-xs text-white/80 tabular-nums [text-shadow:0_1px_3px_rgb(0_0_0/0.8)] ${
          active ? "" : "invisible"
        }`}
      >
        <span className="w-10 text-right">{clock(report.time)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(report.duration, 1)}
          step={1}
          value={Math.min(report.time, report.duration)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Position im Stück"
          className="h-1 flex-1 cursor-pointer accent-amber-400"
        />
        <span className="w-10">{clock(report.duration)}</span>
      </div>
    </>
  );
}

/** Seconds as `m:ss`. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = String(whole % SECONDS_PER_MINUTE).padStart(SECOND_DIGITS, "0");
  return `${minutes}:${rest}`;
}
