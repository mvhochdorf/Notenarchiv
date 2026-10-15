/**
 * The admin's access: signing in with the shared password and changing the
 * catalog.
 *
 * @module
 * @remarks
 * The admins share one Firebase user (email and password, the email set in
 * `verein/config.json`). Its id is listed under `notenarchiv/admins/{uid}`,
 * and only the users listed there may write the catalog or delete reports -
 * see database.rules.json and docs/verwaltung.md.
 *
 * It runs as a second Firebase app beside the anonymous one, so signing in
 * as admin does not change who the device belongs to: ratings and likes
 * stay the musician's own.
 */
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  get,
  getDatabase,
  ref,
  remove,
  set,
  type Database,
} from "firebase/database";
import { useSyncExternalStore } from "react";
import type { CatalogEntry } from "./catalog";
import { CLUB } from "./club";
import { FIREBASE_CONFIG, isFirebaseConfigured } from "./firebase-config";

/** Name of the second Firebase app, beside the anonymous default one. */
const ADMIN_APP = "verwaltung";

/** Where everything of this app lives in the database. */
const ROOT = "notenarchiv";

/**
 * Where the admin stands.
 *
 * - `starting` - not known yet
 * - `unavailable` - no Firebase configured, nothing to administer
 * - `signedOut` - asks for the password
 * - `denied` - signed in, but the account is not listed as admin
 * - `signedIn` - may change the catalog
 */
export type AdminStatus =
  "starting" | "unavailable" | "signedOut" | "denied" | "signedIn";

/** German messages for the sign-in errors people run into. */
const SIGN_IN_ERRORS: Readonly<Record<string, string>> = {
  "auth/invalid-credential": "Das Passwort stimmt nicht.",
  "auth/wrong-password": "Das Passwort stimmt nicht.",
  "auth/user-not-found":
    "Das Verwaltungskonto gibt es in Firebase noch nicht (siehe docs/verwaltung.md).",
  "auth/too-many-requests":
    "Zu viele Versuche - bitte in ein paar Minuten nochmal.",
  "auth/operation-not-allowed":
    "Die Anmeldung mit E-Mail und Passwort ist in Firebase nicht aktiviert.",
  "auth/network-request-failed": "Keine Verbindung zum Internet.",
};

/** The admin's status and account. */
export type AdminState = {
  readonly status: AdminStatus;
  /**
   * The signed-in account's user id - shown while it is not listed yet, so
   * it can be entered in the database (`notenarchiv/admins/{uid}: true`).
   */
  readonly uid: string;
};

/** Before anything is known, also used for the prerender. */
const INITIAL: AdminState = { status: "starting", uid: "" };

let state: AdminState = INITIAL;
let started = false;
const listeners = new Set<() => void>();

/**
 * Subscribes a component to the admin's status.
 *
 * @returns the current status and account
 */
export function useAdmin(): AdminState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}

/**
 * Signs the admin in.
 *
 * @param password - the shared password
 * @returns null when it worked, else what went wrong, in German
 */
export async function signInAdmin(password: string): Promise<string | null> {
  let failure: string | null = null;
  try {
    await signInWithEmailAndPassword(
      getAuth(adminApp()),
      CLUB.admin.email,
      password,
    );
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    failure = SIGN_IN_ERRORS[code] ?? `Anmelden fehlgeschlagen (${code}).`;
  }
  return failure;
}

/** Signs the admin out on this device. */
export async function signOutAdmin(): Promise<void> {
  await signOut(getAuth(adminApp()));
}

/**
 * Adds or changes a piece.
 *
 * @param songId - which piece
 * @param entry - all its fields
 * @param replacesLink - whether the catalog video replaces one a musician
 *   linked in the app; that link is then removed, or it would still win
 */
export async function saveSong(
  songId: string,
  entry: CatalogEntry,
  replacesLink: boolean,
): Promise<void> {
  await set(ref(adminDatabase(), `${ROOT}/catalog/${songId}`), entry);
  if (replacesLink) {
    await remove(ref(adminDatabase(), `${ROOT}/media/${songId}`));
  }
}

/**
 * Removes a piece from the catalog.
 *
 * @param songId - which piece
 * @remarks
 * Its ratings, likes and comments stay in the database, under its id - they
 * show up again should a piece with the same id come back.
 */
export async function deleteSong(songId: string): Promise<void> {
  await remove(ref(adminDatabase(), `${ROOT}/catalog/${songId}`));
}

/**
 * Deletes a report once it has been dealt with.
 *
 * @param songId - the piece it is about
 * @param reportId - which report
 */
export async function deleteReport(
  songId: string,
  reportId: string,
): Promise<void> {
  await remove(ref(adminDatabase(), `${ROOT}/reports/${songId}/${reportId}`));
}

/** Reuses the admin's Firebase app or starts it. */
function adminApp(): FirebaseApp {
  return (
    getApps().find((app) => app.name === ADMIN_APP) ??
    initializeApp(FIREBASE_CONFIG, ADMIN_APP)
  );
}

/** The database as the admin's account sees it. */
function adminDatabase(): Database {
  return getDatabase(adminApp());
}

/** Adds a listener and starts watching the sign-in on first use. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!started) {
    started = true;
    start();
  }
  return () => listeners.delete(listener);
}

/** Follows the admin's sign-in and checks the account is listed. */
function start(): void {
  if (isFirebaseConfigured()) {
    onAuthStateChanged(getAuth(adminApp()), (user) => {
      if (user === null) {
        setState({ status: "signedOut", uid: "" });
      } else {
        get(ref(adminDatabase(), `${ROOT}/admins/${user.uid}`))
          .then((snapshot) =>
            setState({
              status: snapshot.val() === true ? "signedIn" : "denied",
              uid: user.uid,
            }),
          )
          .catch(() => setState({ status: "denied", uid: user.uid }));
      }
    });
  } else {
    setState({ status: "unavailable", uid: "" });
  }
}

/** Swaps in a new state and tells every subscriber. */
function setState(next: AdminState): void {
  state = next;
  listeners.forEach((listener) => listener());
}
