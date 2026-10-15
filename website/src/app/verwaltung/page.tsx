/**
 * Admin page - the pieces of the catalog and the reports.
 *
 * @module
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { AdminView } from "@/components/admin-view";

export const metadata: Metadata = {
  title: "Verwaltung",
  robots: { index: false },
};

/**
 * Renders the admin page.
 *
 * @returns the page element
 */
export default function AdminPage(): ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <AdminView />
    </div>
  );
}
