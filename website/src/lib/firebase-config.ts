/**
 * The project's Firebase web configuration.
 *
 * @module
 * @remarks
 * Comes from `verein/config.json` (`firebase`) - every club has its own
 * project. These values are not a secret: a Firebase web config is meant to
 * ship in the browser; the database is protected by its security rules
 * (`database.rules.json`), not by hiding this.
 *
 * Each value may still be overridden by a `NEXT_PUBLIC_FIREBASE_*`
 * environment variable, e.g. to point a local build at a throwaway project.
 * With an empty config the archive runs in local mode, keeping everything
 * in the browser only.
 */
import type { FirebaseOptions } from "firebase/app";
import { CLUB } from "./club";

/** The Firebase web config, with optional per-value environment overrides. */
export const FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? CLUB.firebase.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? CLUB.firebase.authDomain,
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? CLUB.firebase.databaseURL,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? CLUB.firebase.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    CLUB.firebase.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    CLUB.firebase.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? CLUB.firebase.appId,
};

/**
 * Whether a shared database is configured.
 *
 * @returns true when the config names a project and its database
 */
export function isFirebaseConfigured(): boolean {
  return (
    (FIREBASE_CONFIG.apiKey ?? "") !== "" &&
    (FIREBASE_CONFIG.databaseURL ?? "") !== ""
  );
}
