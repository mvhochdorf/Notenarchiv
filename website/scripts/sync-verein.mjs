/**
 * Puts the club's logo where the framework expects it and makes the browser
 * icons from it.
 *
 * @module
 * @remarks
 * A club only provides `verein/logo.png`. Next.js, though, serves files only
 * from `public/` and takes the browser icons from `src/app/`. This script
 * copies the logo there and draws the icons from it - square, the logo
 * centred. It runs by itself before `npm run dev` and `npm run build`; its
 * results are not committed (see .gitignore).
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/** Browser tab and Android home screen. */
const ICON_SIZE = 192;

/** iPhone and iPad home screen. */
const APPLE_ICON_SIZE = 180;

/** Room around the logo inside an icon, as share of its size. */
const ICON_PADDING = 0.08;

/** Background of the iOS icon, which may not be transparent: the app's black. */
const APPLE_BACKGROUND = { r: 0, g: 0, b: 0, alpha: 1 };

/** Nothing behind the logo. */
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * A path in the website folder, its folder made if missing - `public/`
 * only holds generated files and is not in Git, so a fresh checkout has none.
 */
const here = (path) => {
  const full = fileURLToPath(new URL(`../${path}`, import.meta.url));
  mkdirSync(dirname(full), { recursive: true });
  return full;
};

const logo = here("verein/logo.png");

/** Draws the logo centred on a square of the given size. */
async function icon(size, background, target) {
  const opaque = background.alpha === 1;
  const inner = Math.round(size * (1 - 2 * ICON_PADDING));
  const fitted = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .toBuffer();
  const square = await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toBuffer();
  // iOS wants no transparency: the background is taken in for good.
  await (opaque ? sharp(square).flatten({ background }) : sharp(square))
    .png()
    .toFile(here(target));
}

if (existsSync(logo)) {
  copyFileSync(logo, here("public/logo.png"));
  await icon(ICON_SIZE, TRANSPARENT, "src/app/icon.png");
  await icon(APPLE_ICON_SIZE, APPLE_BACKGROUND, "src/app/apple-icon.png");
  console.log("Vereinslogo und Symbole bereit.");
} else {
  console.warn("verein/logo.png fehlt - die App zeigt dann kein Logo.");
}
