/**
 * Archive page - every piece as a searchable list.
 *
 * @module
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SongList } from "@/components/song-list";

export const metadata: Metadata = { title: "Archiv" };

/**
 * Renders the archive page.
 *
 * @returns the page element
 */
export default function ListPage(): ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <SongList />
    </div>
  );
}
