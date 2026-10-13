/**
 * The icons of the feed's button column, drawn in the current text colour.
 *
 * @module
 * @remarks
 * Emoji would be simpler, but they bring their own colours: a bookmark
 * emoji stays red where a saved piece should turn yellow.
 */
import type { ReactElement } from "react";

/** The icons there are. */
export type IconName = "heart" | "comment" | "bookmark" | "share" | "flag";

/** The outline of each icon, in a 24 by 24 box. */
const PATHS: Readonly<Record<IconName, string>> = {
  heart:
    "M12 21s-7.5-4.6-9.6-9.3C.9 8.4 2.9 4.5 6.6 4.1c2.1-.2 3.9.9 5.4 2.8 1.5-1.9 3.3-3 5.4-2.8 3.7.4 5.7 4.3 4.2 7.6C19.5 16.4 12 21 12 21z",
  comment:
    "M12 3C6.5 3 2 6.7 2 11.3c0 2.5 1.3 4.7 3.4 6.2L4.6 21l4.1-2.2c1 .3 2.1.4 3.3.4 5.5 0 10-3.7 10-8.3S17.5 3 12 3z",
  bookmark: "M6 2.5h12a1 1 0 0 1 1 1V22l-7-4.6L5 22V3.5a1 1 0 0 1 1-1z",
  share: "M14 4l8 7.5-8 7.5v-4.6c-5.6 0-9.4 1.7-12 5.6 1-5.6 4.3-11 12-12.1V4z",
  flag: "M5 2.5a1 1 0 0 1 1 1V4h11.5a1 1 0 0 1 .8 1.6L16 9l2.3 3.4a1 1 0 0 1-.8 1.6H6v7.5a1 1 0 1 1-2 0v-18a1 1 0 0 1 1-1z",
};

/**
 * Renders one icon.
 *
 * @param props - which icon
 * @returns the icon as SVG
 */
export function Icon({ name }: { readonly name: IconName }): ReactElement {
  return (
    <svg viewBox="0 0 24 24" className="size-9" fill="currentColor" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
