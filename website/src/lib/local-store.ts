/**
 * Versioned, failure tolerant access to the browser's localStorage.
 *
 * @module
 */

/**
 * Prefix of every key this app writes.
 *
 * @remarks
 * All GitHub Pages project sites of an account share one origin
 * (`<account>.github.io`), and localStorage is scoped per origin - so without a
 * prefix this app would read and overwrite the data of unrelated projects on
 * the same account. Everything therefore lives below one namespace.
 */
const STORAGE_NAMESPACE = "notenarchiv-app";

/** Separator between the namespace and the key parts. */
const KEY_SEPARATOR = "/";

/** What actually goes to disk - the version lets old data be dropped. */
type Envelope = {
  readonly version: number;
  readonly data: unknown;
};

/**
 * Builds a namespaced storage key.
 *
 * @param parts - key segments, e.g. the feature and the kind of data
 * @returns the full key, e.g. `notenarchiv-app/ratings/mine`
 * @example
 * ```ts
 * storageKey("ratings", "mine"); // "notenarchiv-app/ratings/mine"
 * ```
 */
export function storageKey(...parts: readonly string[]): string {
  return [STORAGE_NAMESPACE, ...parts].join(KEY_SEPARATOR);
}

/**
 * Reads a stored value, dropping anything corrupt, foreign or outdated.
 *
 * @param key - the full key, from {@link storageKey}
 * @param version - the schema version the caller expects
 * @param isValid - guard that checks the payload really has the wanted shape
 * @returns the value, or null if nothing usable is stored
 * @remarks
 * Never throws: a browser with storage disabled, a quota error or a half
 * written entry all simply mean "nothing stored".
 */
export function readStored<T>(
  key: string,
  version: number,
  isValid: (value: unknown) => value is T,
): T | null {
  const raw = safeGetItem(key);
  let result: T | null = null;

  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        isEnvelope(parsed) &&
        parsed.version === version &&
        isValid(parsed.data)
      ) {
        result = parsed.data;
      }
    } catch {
      // Not valid JSON - treat the entry as absent.
    }
  }

  return result;
}

/**
 * Writes a value together with its schema version.
 *
 * @param key - the full key, from {@link storageKey}
 * @param version - the schema version of the payload
 * @param data - the value to store; must be JSON serialisable
 * @returns true if it was stored, false if the browser refused
 */
export function writeStored(
  key: string,
  version: number,
  data: unknown,
): boolean {
  const envelope: Envelope = { version, data };
  let stored = false;

  const storage = getStorage();
  if (storage !== null) {
    try {
      storage.setItem(key, JSON.stringify(envelope));
      stored = true;
    } catch {
      // Quota exceeded or storage disabled - the app keeps working unsaved.
    }
  }

  return stored;
}

/**
 * Deletes a stored value.
 *
 * @param key - the full key, from {@link storageKey}
 */
export function removeStored(key: string): void {
  const storage = getStorage();
  if (storage !== null) {
    try {
      storage.removeItem(key);
    } catch {
      // Nothing we can do - and nothing the user needs to know.
    }
  }
}

/** Returns localStorage, or null when it is unavailable (SSR, privacy mode). */
function getStorage(): Storage | null {
  let storage: Storage | null = null;

  // During the static export there is no window at all.
  if (typeof window !== "undefined") {
    try {
      storage = window.localStorage;
    } catch {
      // Blocked by browser settings.
    }
  }

  return storage;
}

/** Reads a raw entry without ever throwing. */
function safeGetItem(key: string): string | null {
  const storage = getStorage();
  let raw: string | null = null;

  if (storage !== null) {
    try {
      raw = storage.getItem(key);
    } catch {
      // Blocked - behave as if nothing was stored.
    }
  }

  return raw;
}

/** Checks the outer envelope before trusting the payload. */
function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    typeof (value as Envelope).version === "number" &&
    "data" in value
  );
}
