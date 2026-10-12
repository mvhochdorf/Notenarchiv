/**
 * Settings page.
 *
 * @module
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "Einstellungen" };

/**
 * Renders the settings page.
 *
 * @returns the page element
 */
export default function SettingsPage(): ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <SettingsView />
    </div>
  );
}
