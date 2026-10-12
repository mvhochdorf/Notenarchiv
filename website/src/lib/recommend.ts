/**
 * The three feeds: what is new to the visitor, what they might like, and
 * what everybody likes.
 *
 * @module
 */
import { shuffle } from "./library";
import { NO_RATING, type AllVotes, type RatingSummary } from "./ratings";
import type { AllComments, Marks } from "./social";
import type { Song } from "./song";

/** The feeds above the video. */
export type FeedTab = "new" | "forYou" | "trend";

/** Labels of the feeds, in the order they are shown. */
export const FEED_TABS: readonly { tab: FeedTab; label: string }[] = [
  { tab: "new", label: "Neu" },
  { tab: "forYou", label: "Für dich" },
  { tab: "trend", label: "Trend" },
];

/** Everything visitors did, as far as the ranking needs it. */
export type Signals = {
  readonly votes: AllVotes;
  readonly summaries: ReadonlyMap<string, RatingSummary>;
  readonly likes: Marks;
  readonly saved: Marks;
  readonly views: Marks;
  readonly comments: AllComments;
  /** The visitor the feed is for. */
  readonly me: string;
};

/** Stars that neither raise nor lower the approval of a piece. */
const NEUTRAL_STARS = 3;

/** The groups of the "new" feed, in the order they are shown. */
const NEW_GROUPS = {
  unseen: 0,
  untouched: 1,
  unrated: 2,
  rest: 3,
} as const;

/** How much each kind of feature says about a visitor's taste. */
const FEATURE_WEIGHTS = {
  genre: 1,
  occasion: 0.5,
  composer: 1.5,
  arranger: 1,
  publisher: 0.5,
} as const;

/** How the parts of the "for you" score are mixed. */
const MIX = {
  /** Pieces like the ones the visitor likes. */
  taste: 1,
  /** Pieces liked by people with a similar taste. */
  similar: 2,
  /** Pieces everybody likes. */
  popular: 0.3,
  /** Chance, so the feed is not the same on every visit. */
  chance: 0.5,
} as const;

/** What a mere view counts for, against a like, in "people also liked". */
const VIEW_SHARE = 0.3;

/** How much each sign of approval adds to the trend. */
const TREND_WEIGHTS = {
  like: 1,
  save: 1.5,
  comment: 0.5,
  view: 0.1,
  /** Per vote, times how far the average lies above the middle. */
  vote: 0.5,
} as const;

/** Largest value of a 32 bit hash, for turning it into [0, 1). */
const UINT32_RANGE = 4_294_967_296;

/** Multiplier of the string hash (FNV-1a prime). */
const HASH_PRIME = 16_777_619;

/** Start value of the string hash (FNV-1a offset). */
const HASH_OFFSET = 2_166_136_261;

/**
 * The pieces in the order of a feed.
 *
 * @param tab - which feed
 * @param songs - the pieces that pass the visitor's filters
 * @param signals - what visitors did
 * @param seed - fixes the chance in the order for one visit
 * @returns every piece, in feed order
 */
export function rankFeed(
  tab: FeedTab,
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): readonly Song[] {
  let ranked: readonly Song[];
  switch (tab) {
    case "new":
      ranked = rankNew(songs, signals, seed);
      break;
    case "trend":
      ranked = rankTrend(songs, signals, seed);
      break;
    default:
      ranked = rankForYou(songs, signals, seed);
  }
  return ranked;
}

/**
 * New to the visitor first.
 *
 * @param songs - the pieces
 * @param signals - what visitors did
 * @param seed - fixes the order within each group
 * @returns pieces never seen, then seen but neither liked nor rated, then
 *   not rated, then the rest - each group shuffled
 */
export function rankNew(
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): readonly Song[] {
  const groups: Song[][] = Object.values(NEW_GROUPS).map(() => []);
  for (const song of songs) {
    const seen = signals.views[song.id]?.[signals.me] === true;
    const liked = signals.likes[song.id]?.[signals.me] === true;
    const rated = signals.votes[song.id]?.[signals.me] !== undefined;
    let group: number;
    if (!seen) {
      group = NEW_GROUPS.unseen;
    } else if (!liked && !rated) {
      group = NEW_GROUPS.untouched;
    } else if (!rated) {
      group = NEW_GROUPS.unrated;
    } else {
      group = NEW_GROUPS.rest;
    }
    groups[group].push(song);
  }
  return groups.flatMap((group, index) => shuffle(group, (seed + index) % 1));
}

/**
 * What the visitor might like.
 *
 * @param songs - the pieces
 * @param signals - what visitors did
 * @param seed - fixes the chance in the order
 * @returns pieces the visitor has neither liked nor rated yet, best guess
 *   first, then the others
 * @remarks
 * Two guesses are mixed. **Taste**: the categories, composers, arrangers,
 * occasions and publishers of what the visitor liked, saved or rated well
 * count for a piece, those of what they rated badly against it. **Similar
 * people**: the more the likes of another visitor overlap with the
 * visitor's own, the more their likes - and, a little, their views - count.
 * A visitor who has done nothing yet gets popular pieces in a shuffled
 * order.
 */
export function rankForYou(
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): readonly Song[] {
  const { me } = signals;
  const approval = approvals(signals);
  const mine = approval.get(me) ?? new Map<string, number>();
  const taste = tasteOf(songs, mine);
  const similar = similarPeople(approval, me);
  const trend = trendScores(songs, signals);
  const topTrend = Math.max(1, ...trend.values());

  const score = (song: Song) => {
    let alike = 0;
    for (const [person, similarity] of similar) {
      const liked = (approval.get(person)?.get(song.id) ?? 0) > 0;
      const viewed = signals.views[song.id]?.[person] === true;
      alike += similarity * (liked ? 1 : viewed ? VIEW_SHARE : 0);
    }
    return (
      MIX.taste * tasteScore(song, taste) +
      MIX.similar * alike +
      MIX.popular * ((trend.get(song.id) ?? 0) / topTrend) +
      MIX.chance * noise(song.id, seed)
    );
  };

  const scored = songs.map((song) => ({ song, score: score(song) }));
  // A like says as much as stars here: the visitor already knows the piece.
  const judged = (song: Song) =>
    signals.votes[song.id]?.[me] !== undefined ||
    signals.likes[song.id]?.[me] === true;
  const unrated = scored.filter(({ song }) => !judged(song));
  const rated = scored.filter(({ song }) => judged(song));
  const byScore = (a: { score: number }, b: { score: number }) =>
    b.score - a.score;
  return [...unrated.sort(byScore), ...rated.sort(byScore)].map(
    ({ song }) => song,
  );
}

/**
 * What everybody likes most.
 *
 * @param songs - the pieces
 * @param signals - what visitors did
 * @param seed - fixes the order of pieces that score the same
 * @returns the pieces, most liked first
 */
export function rankTrend(
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): readonly Song[] {
  const trend = trendScores(songs, signals);
  // Shuffled first, so equal scores - mostly the many zeros - come in a
  // random order rather than the spreadsheet's.
  return shuffle(songs, seed).sort(
    (a, b) => (trend.get(b.id) ?? 0) - (trend.get(a.id) ?? 0),
  );
}

/** How much every visitor approves of every piece they touched. */
function approvals(signals: Signals): Map<string, Map<string, number>> {
  const all = new Map<string, Map<string, number>>();
  const add = (person: string, songId: string, amount: number) => {
    const byPiece = all.get(person) ?? new Map<string, number>();
    byPiece.set(songId, (byPiece.get(songId) ?? 0) + amount);
    all.set(person, byPiece);
  };
  for (const marks of [signals.likes, signals.saved]) {
    for (const [songId, people] of Object.entries(marks)) {
      for (const person of Object.keys(people)) {
        add(person, songId, 1);
      }
    }
  }
  for (const [songId, votes] of Object.entries(signals.votes)) {
    for (const [person, stars] of Object.entries(votes ?? {})) {
      if (typeof stars === "number") {
        add(person, songId, stars - NEUTRAL_STARS);
      }
    }
  }
  return all;
}

/** How much the visitor likes each feature, from what they approved of. */
function tasteOf(
  songs: readonly Song[],
  mine: ReadonlyMap<string, number>,
): Map<string, number> {
  const taste = new Map<string, number>();
  for (const song of songs) {
    const amount = mine.get(song.id) ?? 0;
    if (amount !== 0) {
      for (const [feature, weight] of features(song)) {
        taste.set(feature, (taste.get(feature) ?? 0) + amount * weight);
      }
    }
  }
  return taste;
}

/** How well a piece fits a taste. */
function tasteScore(song: Song, taste: ReadonlyMap<string, number>): number {
  let score = 0;
  let largest = 0;
  for (const value of taste.values()) {
    largest = Math.max(largest, Math.abs(value));
  }
  for (const [feature, weight] of features(song)) {
    score += (taste.get(feature) ?? 0) * weight;
  }
  return largest === 0 ? 0 : score / largest;
}

/** The describing features of a piece, with their weights. */
function features(song: Song): [string, number][] {
  return (Object.keys(FEATURE_WEIGHTS) as (keyof typeof FEATURE_WEIGHTS)[])
    .filter((key) => song[key] !== null)
    .map((key) => [`${key}:${song[key]}`, FEATURE_WEIGHTS[key]]);
}

/** Other visitors, by how much their likes overlap with the visitor's. */
function similarPeople(
  approval: ReadonlyMap<string, ReadonlyMap<string, number>>,
  me: string,
): Map<string, number> {
  const liked = (person: string) =>
    new Set(
      [...(approval.get(person) ?? new Map<string, number>())]
        .filter(([, amount]) => amount > 0)
        .map(([songId]) => songId),
    );
  const mine = liked(me);
  const similar = new Map<string, number>();
  if (mine.size > 0) {
    for (const person of approval.keys()) {
      const theirs = liked(person);
      const shared = [...theirs].filter((songId) => mine.has(songId)).length;
      if (person !== me && shared > 0) {
        // Cosine similarity of the two sets of liked pieces.
        similar.set(person, shared / Math.sqrt(mine.size * theirs.size));
      }
    }
  }
  return similar;
}

/** How much everybody approves of each piece. */
function trendScores(
  songs: readonly Song[],
  signals: Signals,
): Map<string, number> {
  const count = (marks: Marks, songId: string) =>
    Object.keys(marks[songId] ?? {}).length;
  const scores = new Map<string, number>();
  for (const song of songs) {
    const summary = signals.summaries.get(song.id) ?? NO_RATING;
    const score =
      TREND_WEIGHTS.like * count(signals.likes, song.id) +
      TREND_WEIGHTS.save * count(signals.saved, song.id) +
      TREND_WEIGHTS.comment *
        Object.keys(signals.comments[song.id] ?? {}).length +
      TREND_WEIGHTS.view * count(signals.views, song.id) +
      TREND_WEIGHTS.vote *
        summary.count *
        (summary.count === 0 ? 0 : summary.average - NEUTRAL_STARS);
    scores.set(song.id, score);
  }
  return scores;
}

/** A number in [0, 1) that is the same for the same piece and seed. */
function noise(songId: string, seed: number): number {
  let hash = HASH_OFFSET ^ Math.floor(seed * UINT32_RANGE);
  for (const char of songId) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), HASH_PRIME);
  }
  return (hash >>> 0) / UINT32_RANGE;
}
