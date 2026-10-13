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

/**
 * Pixels of the player cut off above and below.
 *
 * @remarks
 * The frame is taller than the visible box, so the video sits between two
 * black bars - and YouTube draws its title, channel and logo into those bars,
 * where the box cuts them off.
 */
const CROP_PX = 80;

/** How long a press has to last to count as holding. */
const HOLD_MS = 350;

/** Playback speed while the video is held. */
const FAST_RATE = 2;

/**
 * How long the middle of the video stays veiled after the page steers it.
 *
 * @remarks
 * Whenever the player is told to resume or jump, YouTube shows its own
 * pause button in the middle of the frame for about four seconds -
 * `controls=0` does not stop that. The veil, a soft blur over that
 * spot, hides it.
 */
const VEIL_MS = 4600;

/**
 * Speed of a player loaded ahead, while its card waits off screen.
 *
 * @remarks
 * A paused player would show YouTube's own button when told to play. So a
 * player loaded ahead plays instead - silent and at a quarter of the speed,
 * which keeps it close to its start and fully buffered - and coming on
 * screen only speeds it up and turns the sound on, which shows nothing.
 */
const PRELOAD_RATE = 0.25;

/** How far a waiting player may run past its start before it is pulled back. */
const MAX_DRIFT_S = 3;

/** How long a video may take to start before its sound counts as blocked. */
const SOUND_CHECK_MS = 2500;

/** Longest pause between the two taps of a double tap. */
const DOUBLE_TAP_MS = 280;

/** How long the heart of a double tap stays on screen. */
const HEART_MS = 800;

/** How long incoming positions are ignored after the visitor seeks. */
const SEEK_SETTLE_MS = 800;

/** How often the page asks the player to report, until it answers. */
const LISTEN_RETRY_MS = 500;
const LISTEN_TRIES = 10;

/** Seconds per minute, for the time display. */
const SECONDS_PER_MINUTE = 60;

/** Digits of the seconds in the time display. */
const SECOND_DIGITS = 2;

/** States the YouTube player reports. */
const PLAYER = {
  ended: 0,
  playing: 1,
  buffering: 3,
} as const;

/** What the player last reported. */
type Report = {
  /** YouTube's player state, -1 before anything happened. */
  readonly state: number;
  readonly time: number;
  readonly duration: number;
  /** Whether the video has played at all yet. */
  readonly started: boolean;
};

/** A heart popping up where the video was double tapped. */
type Heart = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
};

/** What one player message says; each part only if it says it. */
type PlayerInfo = {
  readonly state?: number;
  readonly time?: number;
  readonly duration?: number;
};

/**
 * Renders the player and its timeline.
 *
 * @param props - the video, whether the sound is off, the piece's title,
 *   and what to do when the visitor wants the next piece at the end
 * @returns the player filling its card, and the timeline at the bottom
 * @remarks
 * The video starts where the visitor's settings say (beginning, middle,
 * random or the most watched part) and plays to its end; then it starts over
 * or the feed moves on, as set.
 *
 * The video fills the whole card, behind the piece's info and buttons. Until
 * it really plays its still image covers the player, so YouTube's loading
 * screen never shows. The frame itself ignores taps and swipes, so swiping
 * over the video moves the feed; a layer above it takes the taps: a tap
 * pauses (a faint play symbol shows it can go on) - or, while the video is
 * still silent, switches the sound on -, a double tap likes the piece, and
 * holding plays at double speed until released.
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
  /** Whether this is the card on screen; the others wait, loaded but still. */
  readonly active: boolean;
  readonly muted: boolean;
  readonly title: string;
  readonly onEnded: () => void;
  readonly onUnmute: () => void;
  /** Called when the browser refuses to play with sound before a touch. */
  readonly onSoundBlocked: () => void;
  readonly onDoubleTap: () => void;
}): ReactElement {
  const frame = useRef<HTMLIFrameElement>(null);
  const { snippetStart: mode, atEnd } = useSettings();
  const [report, setReport] = useState<Report>({
    state: -1,
    time: 0,
    duration: media.duration ?? 0,
    started: false,
  });
  const seekedAt = useRef(0);
  // When the page last jumped this player while it waited off screen.
  const steeredAt = useRef(0);
  const slowed = useRef(false);
  const leftOnce = useRef(false);
  const jumped = useRef(false);
  // Read and written per message, which may come faster than renders.
  const lastState = useRef(-1);
  const [fast, setFast] = useState(false);
  const [veiled, setVeiled] = useState(false);
  const [hearts, setHearts] = useState<readonly Heart[]>([]);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef(0);
  const veilTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const held = useRef(false);
  // Everything is fixed when the player appears; later mute changes go by
  // message, because a new address would restart the video.
  const [plan] = useState(() => {
    const random = Math.random();
    const seek = needsSeek(media, mode);
    const start = seek ? media.start : snippetStart(media, mode, random);
    return {
      start,
      // A player loaded ahead always starts silent, see PRELOAD_RATE.
      src: embedUrl(media, active ? muted : true, start),
      startFor: seek
        ? (duration: number) =>
            snippetStart({ ...media, duration }, mode, random)
        : null,
    };
  });

  // Hides YouTube's own button for as long as it shows; see VEIL_MS.
  const veil = (ms = VEIL_MS) => {
    clearTimeout(veilTimer.current);
    setVeiled(true);
    veilTimer.current = setTimeout(() => setVeiled(false), ms);
  };

  const onInfo = useEffectEvent((info: PlayerInfo) => {
    const player = frame.current;
    const state = info.state ?? lastState.current;
    const settling = Date.now() - seekedAt.current < SEEK_SETTLE_MS;

    if (player !== null) {
      const duration = info.duration ?? 0;
      if (
        plan.startFor !== null &&
        !jumped.current &&
        duration > 0 &&
        state === PLAYER.playing
      ) {
        jumped.current = true;
        veil();
        command(player, "seekTo", [plan.startFor(duration), true]);
      }
      if (!active && !leftOnce.current && state === PLAYER.playing) {
        if (!slowed.current) {
          slowed.current = true;
          command(player, "setPlaybackRate", [PRELOAD_RATE]);
        }
        const time = info.time ?? 0;
        if (time - plan.start > MAX_DRIFT_S) {
          // Back to the start while nobody watches.
          steeredAt.current = Date.now();
          command(player, "seekTo", [plan.start, true]);
        }
      }
      if (
        active &&
        state === PLAYER.ended &&
        lastState.current !== PLAYER.ended
      ) {
        if (atEnd === "next") {
          onEnded();
        } else {
          veil();
          command(player, "seekTo", [0, true]);
          command(player, "playVideo");
        }
      }
    }
    lastState.current = state;
    setReport((previous) => ({
      state,
      duration: info.duration ?? previous.duration,
      time: settling ? previous.time : (info.time ?? previous.time),
      started: previous.started || state === PLAYER.playing,
    }));
  });

  useEffect(() => {
    const player = frame.current;
    let tries = 0;
    // The player only reports once asked to, and only hears the question
    // after it has loaded - so ask until it answers.
    const timer = setInterval(() => {
      tries += 1;
      if (tries > LISTEN_TRIES) {
        clearInterval(timer);
      }
      player?.contentWindow?.postMessage(
        JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
        "*",
      );
    }, LISTEN_RETRY_MS);
    const handle = (event: MessageEvent) => {
      const info = player === null ? null : playerInfo(event, player);
      if (info !== null) {
        clearInterval(timer);
        onInfo(info);
      }
    };
    window.addEventListener("message", handle);
    return () => {
      clearInterval(timer);
      window.removeEventListener("message", handle);
    };
  }, []);

  const onMuted = useEffectEvent((isMuted: boolean) => {
    // Players loaded ahead stay silent until their card comes on screen.
    if (frame.current !== null && active) {
      command(frame.current, isMuted ? "mute" : "unMute");
    }
  });

  // A browser that allows no sound before the first touch does not start a
  // video with sound at all; the feed then goes silent until a touch.
  const checkSound = useEffectEvent(() => {
    if (active && !muted && lastState.current !== PLAYER.playing) {
      if (frame.current !== null) {
        // Silent, the browser lets it play - the video it held back starts.
        // Being told to play shows YouTube's button, see VEIL_MS.
        veil();
        command(frame.current, "mute");
        command(frame.current, "playVideo");
      }
      onSoundBlocked();
    }
  });
  useEffect(() => {
    const timer = setTimeout(checkSound, SOUND_CHECK_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    onMuted(muted);
  }, [muted]);

  // A card coming on screen: a player loaded ahead only speeds up and gets
  // its sound - neither shows YouTube's button - while one that was on screen
  // before resumes. Leaving the screen pauses.
  const onActive = useEffectEvent((isActive: boolean) => {
    const player = frame.current;
    if (player !== null) {
      if (isActive && leftOnce.current) {
        veil();
        command(player, "playVideo");
      } else if (isActive) {
        if (Math.abs(report.time - plan.start) > MAX_DRIFT_S) {
          veil();
          command(player, "seekTo", [plan.start, true]);
        } else if (Date.now() - steeredAt.current < VEIL_MS) {
          // Still showing the button from the last quiet jump back.
          veil(VEIL_MS - (Date.now() - steeredAt.current));
        }
        command(player, "setPlaybackRate", [1]);
        command(player, muted ? "mute" : "unMute");
        command(player, "playVideo");
      } else {
        leftOnce.current = true;
        command(player, "pauseVideo");
      }
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

  // Tap: pause or resume. Hold: double speed until released.
  const onPress = () => {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      setFast(true);
      if (frame.current !== null) {
        command(frame.current, "setPlaybackRate", [FAST_RATE]);
        command(frame.current, "playVideo");
      }
    }, HOLD_MS);
  };
  const onRelease = () => {
    clearTimeout(holdTimer.current);
    if (held.current) {
      setFast(false);
      if (frame.current !== null) {
        command(frame.current, "setPlaybackRate", [1]);
      }
    }
  };
  // A single tap waits a moment, in case a second one makes it a double tap.
  const singleTap = () => {
    if (muted) {
      // The browser started the video silently; the first tap asks for sound.
      onUnmute();
    } else if (frame.current !== null) {
      command(frame.current, playing ? "pauseVideo" : "playVideo");
      if (!playing) {
        veil();
      }
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

  const seek = (seconds: number) => {
    seekedAt.current = Date.now();
    veil();
    setReport((previous) => ({ ...previous, time: seconds }));
    if (frame.current !== null) {
      command(frame.current, "seekTo", [seconds, true]);
    }
  };

  return (
    <>
      <div
        className="absolute inset-0 overflow-hidden bg-black"
        style={{ containerType: "size" }}
      >
        <iframe
          ref={frame}
          src={plan.src}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2"
          style={{
            // Fills the card like a photo set to "cover": the video keeps its
            // shape and is cut at the sides on a phone held upright.
            width: "max(100cqw, calc(100cqh * 16 / 9))",
            height: `calc(max(calc(100cqw * 9 / 16), 100cqh) + ${2 * CROP_PX}px)`,
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
          aria-label={playing ? "Anhalten" : "Weiterspielen"}
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
          {report.started && (veiled || report.state === PLAYER.buffering) && (
            // Covers YouTube's own symbols in the middle of the frame:
            // its pause sign right after resuming, its spinner while it
            // loads.
            <span className="absolute size-28 rounded-full bg-black/10 backdrop-blur-xl [mask-image:radial-gradient(circle,black_45%,transparent_70%)]" />
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

/** Sends a command to the YouTube player inside the frame. */
function command(
  player: HTMLIFrameElement,
  func: string,
  args: readonly unknown[] = [],
): void {
  player.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "*",
  );
}

/** What a message from the player says, or null if it is not one. */
function playerInfo(
  event: MessageEvent,
  player: HTMLIFrameElement,
): PlayerInfo | null {
  let result: PlayerInfo | null = null;
  if (event.source === player.contentWindow && typeof event.data === "string") {
    try {
      const data = JSON.parse(event.data) as { event?: string; info?: unknown };
      if (data.event === "onStateChange") {
        result = { state: numberOrNot(data.info) };
      } else if (typeof data.info === "object" && data.info !== null) {
        const info = data.info as Record<string, unknown>;
        result = {
          state: numberOrNot(info.playerState),
          time: numberOrNot(info.currentTime),
          duration: numberOrNot(info.duration),
        };
      }
    } catch {
      // Not a player message.
    }
  }
  return result;
}

/** The value if it is a number. */
function numberOrNot(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** Seconds as `m:ss`. */
function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = String(whole % SECONDS_PER_MINUTE).padStart(SECOND_DIGITS, "0");
  return `${minutes}:${rest}`;
}
