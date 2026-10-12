/**
 * The project's Firebase web configuration.
 *
 * @module
 * @remarks
 * These values are not a secret. A Firebase web config is meant to ship in the
 * browser; the database is protected by its security rules
 * (`database.rules.json`), not by hiding this. That is why the config is
 * committed here rather than kept out of the repo - it just works on GitHub
 * Pages without any CI setup.
 *
 * Each value may still be overridden by a `NEXT_PUBLIC_FIREBASE_*` environment
 * variable, e.g. to point a local build at a throwaway project. When the
 * variable is absent the committed default is used. With both empty the
 * archive runs in local mode, keeping everything in the browser only.
 */
import type { FirebaseOptions } from "firebase/app";

/** The Firebase web config, with optional per-value environment overrides. */
export const FIREBASE_CONFIG: FirebaseOptions = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyAzANaaK0y1quupqzctVjVFmwxTDJLR92s",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "notenarchiv-mvhochdorf.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ??
    "https://notenarchiv-mvhochdorf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "notenarchiv-mvhochdorf",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "notenarchiv-mvhochdorf.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "348063435263",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:348063435263:web:ed190623d52a27c7a13fca",
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
