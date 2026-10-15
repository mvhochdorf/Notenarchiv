/**
 * The page shown when an address leads nowhere.
 *
 * @module
 * @remarks
 * A dead end needs one thing above all: a way out. The framework's own page
 * offers none, and it speaks English. So this one says what happened in a
 * line and puts the ways back - to Play and to the archive - front and
 * centre.
 *
 * Rendered inside the root layout, so the tab bar stays at the bottom. In
 * the static export it becomes `out/404.html`, which GitHub Pages serves for
 * any address that does not exist.
 */
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { ClubLogo } from "@/components/club-logo";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  description: "Diese Adresse gibt es nicht - zurück zum Notenarchiv.",
};

/**
 * Renders the 404 page.
 *
 * @returns the page element
 */
export default function NotFound(): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-center">
      <ClubLogo className="size-20" />
      <div className="space-y-2">
        <p
          aria-hidden
          className="text-6xl font-black text-white/20 tabular-nums"
        >
          404
        </p>
        <h1 className="text-2xl font-bold">Diese Seite gibt es nicht</h1>
        <p className="max-w-sm text-sm text-white/60">
          Vielleicht ein alter oder falsch kopierter Link. Die Noten findest du
          hier:
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-amber-400 px-5 py-2.5 font-semibold text-black hover:bg-amber-300"
        >
          ▶ Zu Play
        </Link>
        <Link
          href="/liste/"
          className="rounded-full bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/20"
        >
          ☰ Zum Archiv
        </Link>
      </div>
    </div>
  );
}
