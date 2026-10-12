/**
 * Values that only exist in the browser, read without a hydration mismatch.
 *
 * @module
 * @remarks
 * The static export is rendered once at build time, where there is neither a
 * random seed for this visit nor an address hash. Reading them through
 * `useSyncExternalStore` gives the prerender `null` and the browser the real
 * value, and React switches over cleanly after hydration.
 */
import { useSyncExternalStore } from "react";

/** The shuffle seed of this visit, fixed once it is first read. */
let seed: number | null = null;

/**
 * The random seed of this visit.
 *
 * @returns a number in [0, 1), or null during the prerender
 * @remarks
 * Fixed for the whole visit, so going from the list back to the feed shows
 * the same shuffled order instead of a new one.
 */
export function useVisitSeed(): number | null {
  return useSyncExternalStore(subscribeNever, visitSeed, serverNull);
}

/**
 * Draws a new seed for the rest of the visit.
 *
 * @returns the new seed
 */
export function reshuffle(): number {
  seed = Math.random();
  return seed;
}

/**
 * The song id in the address hash (`/#1001-a-banda`).
 *
 * @returns the id, an empty string without hash, or null during the prerender
 */
export function useHashSongId(): string | null {
  return useSyncExternalStore(subscribeHash, hashSongId, serverNull);
}

/**
 * Whether the page runs in the browser yet.
 *
 * @returns false during the prerender and the first render after it, true
 *   from then on
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, browserTrue, serverFalse);
}

/** The seed, drawn on first use. */
function visitSeed(): number {
  seed ??= Math.random();
  return seed;
}

/** The hash without its `#`. */
function hashSongId(): string {
  return decodeURIComponent(window.location.hash.slice(1));
}

/** Follows changes of the address hash. */
function subscribeHash(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

/** For values that do not change while the page is open. */
function subscribeNever(): () => void {
  return () => undefined;
}

/** What the prerender sees. */
function serverNull(): null {
  return null;
}

/** What the browser sees. */
function browserTrue(): boolean {
  return true;
}

/** What the prerender sees. */
function serverFalse(): boolean {
  return false;
}
