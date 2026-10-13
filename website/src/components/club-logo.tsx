/**
 * The club's logo, as it appears in the app.
 *
 * @module
 * @remarks
 * The image lives in `public/`, so it can be swapped without touching any
 * code - see docs/logo.md.
 */
import type { ReactElement } from "react";

/**
 * File of the logo in `public/`.
 *
 * @remarks
 * Change only if the new logo comes in another format, e.g. `logo.svg`.
 */
const LOGO_FILE = "logo.png";

/**
 * Sub path the site is served from, e.g. `/Notenarchiv` on GitHub Pages.
 *
 * @remarks
 * A plain image does not get it added by the framework, so it is put in
 * front here - the same value next.config.ts uses.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Renders the logo.
 *
 * @param props - the size and spacing classes
 * @returns the image
 */
export function ClubLogo({
  className,
}: {
  readonly className: string;
}): ReactElement {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static export has no image optimizer
    <img
      src={`${BASE_PATH}/${LOGO_FILE}`}
      alt="Vereinslogo"
      className={`object-contain ${className}`}
    />
  );
}
