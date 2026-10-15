/**
 * The three feeds: what is new to the visitor, what they might like, and
 * what everybody likes.
 *
 * @module
 */
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

/** Most stars, to turn the visitor's own stars into a share. */
const MAX_STARS = 5;

/**
 * The stages every feed goes through, in this order.
 *
 * @remarks
 * A stage only starts when the one before is used up: first everything the
 * visitor has never seen, then what they have seen but neither rated nor
 * liked, and only then the rest - mostly what they liked best.
 */
const STAGES = {
  unseen: 0,
  untouched: 1,
  judged: 2,
} as const;

/**
 * How the last stage mixes the visitor's own verdict with the feed's own
 * order - mostly what they rated or liked best.
 */
const OWN_VERDICT_SHARE = 0.75;

/**
 * Smallest chance weight in the last stage, so a piece rated poorly still
 * comes up now and then rather than always last.
 */
const MIN_WEIGHT = 0.05;

/**
 * How strongly the verdict decides in the last stage: the weight grows with
 * the verdict to this power, so well liked pieces come first far more often.
 */
const WEIGHT_POWER = 2;

/**
 * How much the others' approval counts among the pieces not seen yet,
 * against the feed's own order: mostly what the others rated well comes
 * first.
 */
const OTHERS_SHARE = 0.6;

/** What a like adds to the visitor's own verdict, against full stars. */
const LIKE_SHARE = 0.5;

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

/** Weight of chance in the trend: just enough to order equal scores. */
const TREND_CHANCE = 0.001;

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
 * @remarks
 * Every feed goes through the same {@link STAGES}; the feed decides the
 * order within each stage - "new" the newest pieces first, "for you" what
 * fits the visitor's taste, "trend" what everybody likes. Among the pieces
 * the visitor has not seen yet, what the others rated well weighs most (see
 * {@link OTHERS_SHARE}); in the last stage the visitor's own stars and likes
 * do, in an order that changes with every visit (see `weightedShuffle`).
 */
export function rankFeed(
  tab: FeedTab,
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): readonly Song[] {
  const order = feedOrder(tab, songs, signals, seed);
  const stages: Song[][] = Object.values(STAGES).map(() => []);
  for (const song of songs) {
    stages[stageOf(song, signals)].push(song);
  }
  const byOrder = (a: Song, b: Song) =>
    (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0);
  const verdict = (song: Song) =>
    OWN_VERDICT_SHARE * ownVerdict(song, signals) +
    (1 - OWN_VERDICT_SHARE) * (order.get(song.id) ?? 0);
  const othersLike = othersApproval(songs, signals);
  const unseenFirst = (song: Song) =>
    OTHERS_SHARE * (othersLike.get(song.id) ?? 0) +
    (1 - OTHERS_SHARE) * (order.get(song.id) ?? 0);
  return [
    ...stages[STAGES.unseen].sort((a, b) => unseenFirst(b) - unseenFirst(a)),
    ...stages[STAGES.untouched].sort(byOrder),
    ...weightedShuffle(stages[STAGES.judged], verdict, seed),
  ];
}

/**
 * The "new" feed: newest pieces first within each stage.
 *
 * @param songs - the pieces
 * @param signals - what visitors did
 * @param seed - fixes the order of pieces added on the same day
 * @returns the pieces in feed order
 */
export function rankNew(
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): readonly Song[] {
  return rankFeed("new", songs, signals, seed);
}

/**
 * The "for you" feed: what fits the visitor's taste first within each stage.
 *
 * @param songs - the pieces
 * @param signals - what visitors did
 * @param seed - fixes the chance in the order
 * @returns the pieces in feed order
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
  return rankFeed("forYou", songs, signals, seed);
}

/**
 * The "trend" feed: what everybody likes most first within each stage.
 *
 * @param songs - the pieces
 * @param signals - what visitors did
 * @param seed - fixes the order of pieces that score the same
 * @returns the pieces in feed order
 */
export function rankTrend(
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): readonly Song[] {
  return rankFeed("trend", songs, signals, seed);
}

/**
 * How well the others like each piece, from 0 (not at all or not rated) to
 * 1 (best liked of all).
 *
 * @remarks
 * The trend score, scaled by the best one: pieces nobody rated get 0, so
 * among them the feed's own order decides.
 */
function othersApproval(
  songs: readonly Song[],
  signals: Signals,
): Map<string, number> {
  const trend = trendScores(songs, signals);
  const best = Math.max(0, ...trend.values());
  return new Map(
    songs.map((song) => [
      song.id,
      best === 0 ? 0 : Math.max(0, trend.get(song.id) ?? 0) / best,
    ]),
  );
}

/**
 * Shuffles pieces so that the better ones mostly, but not always, come first.
 *
 * @param songs - the pieces
 * @param verdict - how much each piece is liked, from 0 to 1
 * @param seed - the visit's chance; a new visit shuffles anew
 * @returns the pieces in a weighted random order
 * @remarks
 * Weighted sampling without replacement (Efraimidis and Spirakis): every
 * piece draws a key `u^(1/w)` from its chance `u` and weight `w`, and the
 * keys are sorted. A piece twice as heavy is drawn ahead of another about
 * twice as often - so the order changes with each visit, and what the
 * visitor liked best still leads most of the time.
 */
function weightedShuffle(
  songs: readonly Song[],
  verdict: (song: Song) => number,
  seed: number,
): Song[] {
  const key = (song: Song) => {
    const weight = MIN_WEIGHT + verdict(song) ** WEIGHT_POWER;
    // The chance must not be 0, or every key would be 0.
    const chance = Math.max(noise(song.id, seed), Number.EPSILON);
    return chance ** (1 / weight);
  };
  const keys = new Map(songs.map((song) => [song.id, key(song)]));
  return [...songs].sort(
    (a, b) => (keys.get(b.id) ?? 0) - (keys.get(a.id) ?? 0),
  );
}

/** Which stage a piece is in for the visitor. */
function stageOf(song: Song, signals: Signals): number {
  const { me } = signals;
  const liked = signals.likes[song.id]?.[me] === true;
  const rated = signals.votes[song.id]?.[me] !== undefined;
  // Liking or rating a piece means having seen it.
  const seen = signals.views[song.id]?.[me] === true || liked || rated;
  let stage: number;
  if (!seen) {
    stage = STAGES.unseen;
  } else if (!liked && !rated) {
    stage = STAGES.untouched;
  } else {
    stage = STAGES.judged;
  }
  return stage;
}

/** The visitor's own verdict on a piece, from 0 to 1. */
function ownVerdict(song: Song, signals: Signals): number {
  const stars = signals.votes[song.id]?.[signals.me];
  const liked = signals.likes[song.id]?.[signals.me] === true;
  const starShare = typeof stars === "number" ? stars / MAX_STARS : LIKE_SHARE;
  return (starShare + (liked ? LIKE_SHARE : 0)) / (1 + LIKE_SHARE);
}

/**
 * Each piece's place in the feed's own order, from 0 (last) to 1 (first).
 *
 * @remarks
 * A share rather than a raw score, so the last stage can mix it with the
 * visitor's own verdict whatever the feed.
 */
function feedOrder(
  tab: FeedTab,
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): Map<string, number> {
  let scores: Map<string, number>;
  switch (tab) {
    case "new":
      scores = newness(songs, seed);
      break;
    case "trend": {
      const trend = trendScores(songs, signals);
      scores = new Map(
        songs.map((song) => [
          song.id,
          // A touch of chance orders the many pieces nobody touched yet.
          (trend.get(song.id) ?? 0) + TREND_CHANCE * noise(song.id, seed),
        ]),
      );
      break;
    }
    default:
      scores = tasteScores(songs, signals, seed);
  }
  const ranked = [...songs].sort(
    (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0),
  );
  return new Map(
    ranked.map((song, index) => [
      song.id,
      1 - index / Math.max(1, songs.length),
    ]),
  );
}

/** How new each piece is: when it was added, then its archive number. */
function newness(songs: readonly Song[], seed: number): Map<string, number> {
  const ranked = [...songs].sort(
    (a, b) =>
      (b.added ?? "").localeCompare(a.added ?? "") ||
      archiveNumber(b) - archiveNumber(a) ||
      noise(b.id, seed) - noise(a.id, seed),
  );
  return new Map(ranked.map((song, index) => [song.id, -index]));
}

/** The archive number as a number, lowest for pieces without one. */
function archiveNumber(song: Song): number {
  const number = parseInt(song.number ?? "", 10);
  return Number.isNaN(number) ? -1 : number;
}

/** How well each piece fits the visitor's taste, see {@link rankForYou}. */
function tasteScores(
  songs: readonly Song[],
  signals: Signals,
  seed: number,
): Map<string, number> {
  const { me } = signals;
  const approval = approvals(signals);
  const mine = approval.get(me) ?? new Map<string, number>();
  const taste = tasteOf(songs, mine);
  const similar = similarPeople(approval, me);
  const trend = trendScores(songs, signals);
  const topTrend = Math.max(1, ...trend.values());

  return new Map(
    songs.map((song) => {
      let alike = 0;
      for (const [person, similarity] of similar) {
        const liked = (approval.get(person)?.get(song.id) ?? 0) > 0;
        const viewed = signals.views[song.id]?.[person] === true;
        alike += similarity * (liked ? 1 : viewed ? VIEW_SHARE : 0);
      }
      return [
        song.id,
        MIX.taste * tasteScore(song, taste) +
          MIX.similar * alike +
          MIX.popular * ((trend.get(song.id) ?? 0) / topTrend) +
          MIX.chance * noise(song.id, seed),
      ];
    }),
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
