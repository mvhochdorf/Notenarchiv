/**
 * Five stars to rate a piece with.
 *
 * @module
 */
"use client";

import type { ReactElement } from "react";
import { MAX_STARS } from "@/lib/ratings";

/** Size variants of the stars. */
const SIZES = {
  large: "text-4xl",
  small: "text-base",
} as const;

/**
 * Renders the stars; tapping the current rating again takes it back.
 *
 * @param props - the visitor's stars (null if not rated), what happens on a
 *   tap (omit for a read-only display), and the size
 * @returns the star row
 */
export function StarRating({
  value,
  onRate,
  size = "large",
}: {
  readonly value: number | null;
  readonly onRate?: (stars: number | null) => void;
  readonly size?: keyof typeof SIZES;
}): ReactElement {
  const stars = Array.from({ length: MAX_STARS }, (unused, index) => index + 1);
  return (
    <div
      className={`flex gap-1 ${SIZES[size]} leading-none`}
      role={onRate === undefined ? "img" : "radiogroup"}
      aria-label={value === null ? "Nicht bewertet" : `${value} von 5 Sternen`}
    >
      {stars.map((star) => {
        const filled = value !== null && star <= value;
        const glyph = (
          <span
            className={
              filled
                ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                : "text-white/35"
            }
          >
            ★
          </span>
        );
        return onRate === undefined ? (
          <span key={star}>{glyph}</span>
        ) : (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} Sterne`}
            className="transition-transform active:scale-125"
            onClick={() => onRate(star === value ? null : star)}
          >
            {glyph}
          </button>
        );
      })}
    </div>
  );
}
