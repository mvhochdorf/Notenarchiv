/**
 * Inbox page - what the others did in the archive.
 *
 * @module
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { InboxView } from "@/components/inbox-view";

export const metadata: Metadata = { title: "Posteingang" };

/**
 * Renders the inbox.
 *
 * @returns the page element
 */
export default function InboxPage(): ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <InboxView />
    </div>
  );
}
