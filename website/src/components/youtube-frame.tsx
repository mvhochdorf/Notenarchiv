/**
 * One embedded YouTube player and the messages it sends.
 *
 * @module
 */
"use client";

import { useEffect, useEffectEvent, useRef, type ReactElement } from "react";

/**
 * Pixels of the player cut off above and below.
 *
 * @remarks
 * The frame is taller than the visible box, so the video sits between two
 * black bars - and YouTube draws its title, channel and logo into those bars,
 * where the box cuts them off.
 */
const CROP_PX = 80;

/**
 * Room kept free right of the visible strip, from the video's middle.
 *
 * @remarks
 * YouTube puts its own play and pause button in the middle of the player
 * for a few seconds whenever playback starts - and no player setting
 * stops it. So the video is placed with its middle just off the right edge
 * of the card: the button is never in sight. Next to it YouTube also shows
 * a "previous" button, reaching 110 pixels left of the middle; this is that
 * and a margin.
 */
const BUTTON_CLEARANCE_PX = 130;

/**
 * Width of the video, as CSS.
 *
 * @remarks
 * At least twice the card plus the clearance, so a strip of card width fits
 * left of the middle; and at least wide enough that the video, kept in its
 * shape, still fills the card's height.
 */
const VIDEO_WIDTH = `max(calc(200cqw + ${2 * BUTTON_CLEARANCE_PX}px), calc(100cqh * 16 / 9))`;

/** How often the page asks the player to report, until it answers. */
const LISTEN_RETRY_MS = 500;
const LISTEN_TRIES = 10;

/** What one player message says; each part only if it says it. */
export type PlayerInfo = {
  readonly state?: number;
  readonly time?: number;
  readonly duration?: number;
};

/**
 * Renders the player, filling its box like a photo set to "cover" - the
 * part of the video just left of its middle, see {@link BUTTON_CLEARANCE_PX}.
 *
 * @param props - the player address, its title, where to report what the
 *   player says, and where to hand out the frame for sending commands
 * @returns the frame
 * @remarks
 * The player only reports once asked to, and only hears the question after
 * it has loaded - so it is asked every half second until it answers. The
 * frame ignores taps and swipes; the page above it takes them.
 */
export function YouTubeFrame({
  src,
  title,
  onInfo,
  onFrame,
}: {
  readonly src: string;
  readonly title: string;
  readonly onInfo: (info: PlayerInfo) => void;
  readonly onFrame: (frame: HTMLIFrameElement | null) => void;
}): ReactElement {
  const frame = useRef<HTMLIFrameElement>(null);
  const report = useEffectEvent((info: PlayerInfo) => onInfo(info));

  useEffect(() => {
    const player = frame.current;
    let tries = 0;
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
        report(info);
      }
    };
    window.addEventListener("message", handle);
    return () => {
      clearInterval(timer);
      window.removeEventListener("message", handle);
    };
  }, []);

  return (
    <iframe
      ref={(element) => {
        frame.current = element;
        onFrame(element);
      }}
      src={src}
      title={title}
      allow="autoplay; encrypted-media; picture-in-picture"
      className="pointer-events-none absolute top-1/2 -translate-y-1/2"
      style={{
        width: VIDEO_WIDTH,
        height: `calc(${VIDEO_WIDTH} * 9 / 16 + ${2 * CROP_PX}px)`,
        // The visible strip ends just left of the video's middle.
        left: `calc(100cqw + ${BUTTON_CLEARANCE_PX}px - ${VIDEO_WIDTH} / 2)`,
      }}
    />
  );
}

/**
 * Sends a command to the YouTube player inside a frame.
 *
 * @param player - the frame
 * @param func - the player function, e.g. `pauseVideo`
 * @param args - its arguments
 */
export function command(
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
