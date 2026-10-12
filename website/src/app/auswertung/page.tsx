/**
 * Evaluation page - what all musicians rated, liked and wrote.
 *
 * @module
 */
import type { Metadata } from "next";
import type { ReactElement } from "react";
import { EvaluationView } from "@/components/evaluation-view";

export const metadata: Metadata = { title: "Auswertung" };

/**
 * Renders the evaluation page.
 *
 * @returns the page element
 */
export default function EvaluationPage(): ReactElement {
  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      <EvaluationView />
    </div>
  );
}
