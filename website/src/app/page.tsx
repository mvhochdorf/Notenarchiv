/**
 * Start page - the swipeable feed.
 *
 * @module
 */
import type { ReactElement } from "react";
import { Feed } from "@/components/feed";

/**
 * Renders the feed page.
 *
 * @returns the page element
 */
export default function Home(): ReactElement {
  return <Feed />;
}
