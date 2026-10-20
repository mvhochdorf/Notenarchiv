/**
 * Lazily starts Firebase in the browser and signs the musician in anonymously.
 *
 * @module
 * @remarks
 * Everything here runs only in the browser, never during the static prerender.
 * Both the app and the anonymous sign-in are set up once and then reused, so
 * switching between feed and list does not start a second Firebase.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
} from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { FIREBASE_CONFIG } from "./firebase-config";

/** Name Firebase gives the app started without a name of its own. */
const DEFAULT_APP = "[DEFAULT]";

/**
 * Reuses the running app or starts it the first time it is needed.
 *
 * @remarks
 * Looks for the default app by name: the admin's second app (see admin.ts)
 * may already be running, and must not be taken for this one.
 */
function firebaseApp(): FirebaseApp {
  return getApps().some((app) => app.name === DEFAULT_APP)
    ? getApp()
    : initializeApp(FIREBASE_CONFIG);
}

/**
 * The Realtime Database handle.
 *
 * @returns the database of the configured project
 */
export function database(): Database {
  return getDatabase(firebaseApp());
}

/**
 * Signs the visitor in anonymously and returns their stable id.
 *
 * @returns the anonymous user id, stable per browser
 * @remarks
 * The id is what a rating is stored under, so one browser has one vote per
 * piece and can change it later. Firebase keeps the anonymous session across
 * visits. Resolves as soon as Firebase reports a signed-in user, whether it
 * had to create one or a previous session was still valid.
 */
export function signIn(): Promise<string> {
  const auth: Auth = getAuth(firebaseApp());
  return new Promise<string>((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (user !== null) {
          stop();
          resolve(user.uid);
        }
      },
      (error) => {
        stop();
        reject(error);
      },
    );
    // Kicks off a sign-in if none is restored; the listener above delivers the
    // uid either way, so the result of this call itself is not needed.
    signInAnonymously(auth).catch(reject);
  });
}
