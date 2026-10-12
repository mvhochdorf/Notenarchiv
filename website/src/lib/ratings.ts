/**
 * Star ratings: what is stored, and how it becomes a popularity score.
 *
 * @module
 */

/** Fewest stars a piece can get. */
export const MIN_STARS = 1;

/** Most stars a piece can get. */
export const MAX_STARS = 5;

/**
 * How many imaginary average votes every piece starts with.
 *
 * @remarks
 * Without them a piece with a single five-star vote would outrank one with
 * thirty votes averaging 4.8. Each real vote pulls the score away from the
 * archive-wide mean, so a piece has to be liked by several people to lead.
 */
const PRIOR_VOTES = 3;

/** Every vote of one piece, keyed by the voter's id. */
export type Votes = Readonly<Record<string, number>>;

/** Every vote in the archive, keyed by song id. */
export type AllVotes = Readonly<Record<string, Votes>>;

/** What the votes of one piece add up to. */
export type RatingSummary = {
  /** Plain average of the stars, 0 without votes. */
  readonly average: number;
  readonly count: number;
  /** Ranking value that weighs the average by the number of votes. */
  readonly score: number;
};

/** The summary of a piece nobody has rated yet. */
export const NO_RATING: RatingSummary = { average: 0, count: 0, score: 0 };

/**
 * Whether a value is a valid number of stars.
 *
 * @param value - anything read from storage or the database
 * @returns true for a whole number from {@link MIN_STARS} to {@link MAX_STARS}
 */
export function isStars(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_STARS &&
    value <= MAX_STARS
  );
}

/**
 * Sums up the votes of every piece.
 *
 * @param all - the votes as read from the database
 * @returns one summary per song id that has at least one valid vote
 * @remarks
 * Invalid values are skipped rather than trusted: the node is written by
 * every visitor, and one bad entry must not decide the ranking.
 */
export function summarize(all: AllVotes): ReadonlyMap<string, RatingSummary> {
  const sums = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;
  let grandCount = 0;

  for (const [songId, votes] of Object.entries(all)) {
    let total = 0;
    let count = 0;
    for (const stars of Object.values(votes ?? {})) {
      if (isStars(stars)) {
        total += stars;
        count += 1;
      }
    }
    if (count > 0) {
      sums.set(songId, { total, count });
      grandTotal += total;
      grandCount += count;
    }
  }

  const mean = grandCount > 0 ? grandTotal / grandCount : 0;
  const summaries = new Map<string, RatingSummary>();
  for (const [songId, { total, count }] of sums) {
    summaries.set(songId, {
      average: total / count,
      count,
      score: (PRIOR_VOTES * mean + total) / (PRIOR_VOTES + count),
    });
  }
  return summaries;
}
