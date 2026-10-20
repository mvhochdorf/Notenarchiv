/**
 * The visitor's profile picture, kept on this device only.
 *
 * @module
 * @remarks
 * The picture never leaves the browser: it is shrunk to a small square and
 * stored in localStorage. Other devices, and the other musicians, do not
 * see it.
 */
import { useSyncExternalStore } from "react";
import { readStored, storageKey, writeStored } from "./local-store";

/** Where the picture is kept. */
const AVATAR_KEY = storageKey("avatar");

/** Schema version of the stored entry. */
const AVATAR_VERSION = 1;

/** Side of the stored square, in pixels - enough for a sharp round picture. */
const AVATAR_SIZE = 256;

/** JPEG quality of the stored picture. */
const AVATAR_QUALITY = 0.85;

let avatar: string | null = null;
let read = false;
const listeners = new Set<() => void>();

/**
 * Subscribes a component to the picture.
 *
 * @returns the picture as a data URL, or null without one
 */
export function useAvatar(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => avatar,
    () => null,
  );
}

/**
 * Takes a picture the visitor chose as their profile picture.
 *
 * @param file - an image file from the device
 * @returns false when the file could not be read as an image
 * @remarks
 * The middle square is cut out and shrunk, so a photo of any size and shape
 * fits.
 */
export async function setAvatar(file: File): Promise<boolean> {
  let done = false;
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    canvas
      .getContext("2d")
      ?.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
    bitmap.close();
    store(canvas.toDataURL("image/jpeg", AVATAR_QUALITY));
    done = true;
  } catch {
    // Not an image the browser can read.
  }
  return done;
}

/** Removes the profile picture. */
export function removeAvatar(): void {
  store(null);
}

/** Keeps the picture and tells every subscriber. */
function store(picture: string | null): void {
  avatar = picture;
  writeStored(AVATAR_KEY, AVATAR_VERSION, picture);
  listeners.forEach((listener) => listener());
}

/** Adds a listener and reads the stored picture on first use. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!read) {
    read = true;
    avatar = readStored(
      AVATAR_KEY,
      AVATAR_VERSION,
      (value): value is string =>
        typeof value === "string" && value.startsWith("data:image/"),
    );
    listener();
  }
  return () => listeners.delete(listener);
}
