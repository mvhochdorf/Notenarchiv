/**
 * Next.js configuration - static export for GitHub Pages.
 *
 * @module
 */
import type { NextConfig } from "next";

/**
 * Sub path the site is served from.
 *
 * @remarks
 * GitHub Pages serves a project site under `/<repo>`, so every asset needs
 * that prefix. The CI passes the value in (from the configure-pages action),
 * which keeps this working if the repository is ever renamed or moved to a
 * custom domain. Locally the value is empty and the site runs at `/`.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Emit plain HTML/CSS/JS into out/ - GitHub Pages cannot run a server.
  output: "export",
  basePath,
  // Without a server there is no image optimizer.
  images: { unoptimized: true },
  // Emit out/index.html style paths, which static hosts resolve directly.
  trailingSlash: true,
};

export default nextConfig;
