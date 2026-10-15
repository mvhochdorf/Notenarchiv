/**
 * Add page - every musician can add a piece.
 *
 * @module
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AddSongView } from "@/components/add-song-view";

export const metadata: Metadata = { title: "Neues Stück" };

/**
 * Renders the page for adding a piece.
 *
 * @returns the page element
 */
export default function AddPage(): ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <AddSongView />
    </div>
  );
}
