/**
 * Five stars to rate a piece with, and a zero for "not at all".
 *
 * @module
 */
"use client";

import type { ReactElement } from "react";
import { MAX_STARS } from "@/lib/ratings";

/** Size variants of the stars. */
const SIZES = {
  large: "text-4xl",
  medium: "text-2xl",
  small: "text-base",
} as const;

/**
 * Renders the stars; tapping the current rating again takes it back.
 *
 * @param props - the visitor's stars (null if not rated, 0 for zero stars),
 *   what happens on a tap (omit for a read-only display), and the size
 * @returns the star row
 * @remarks
 * To rate a piece with zero stars there is a crossed-out star in front of
 * the stars; it only shows where one can rate.
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
      {onRate !== undefined && (
        <button
          type="button"
          role="radio"
          aria-checked={value === 0}
          aria-label="0 Sterne"
          title="0 Sterne - gefällt mir gar nicht"
          className={`mr-1 transition-transform active:scale-125 ${
            value === 0
              ? "text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]"
              : "text-white/35"
          }`}
          onClick={() => onRate(value === 0 ? null : 0)}
        >
          <NoStar />
        </button>
      )}
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

/** A crossed-out star, the symbol for zero stars, as big as a star glyph. */
function NoStar(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[0.9em]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />
      <path d="M4 4l16 16" strokeWidth={2.5} />
    </svg>
  );
}
