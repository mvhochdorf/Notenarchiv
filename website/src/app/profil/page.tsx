/**
 * Profile page: the visitor's name and settings.
 *
 * @module
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { SettingsView } from "@/components/settings-view";

export const metadata: Metadata = { title: "Profil" };

/**
 * Renders the profile page.
 *
 * @returns the page element
 */
export default function ProfilePage(): ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <SettingsView />
    </div>
  );
}
