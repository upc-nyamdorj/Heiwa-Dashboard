/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // No assetPrefix: assets must be referenced from the root as /_next/…, not
  // relatively as ./_next/….
  //
  // Every exported page shares one asset prefix, 404.html included, and that
  // page is what the Worker serves for an unmatched path. Served relatively at
  // a nested URL such as /api/auth/login, ./_next/… resolves against /api/auth/
  // and every chunk 404s — the page renders, unstyled and dead, while the
  // network tab fills with /api/auth/_next/static/… misses.
  //
  // The relative form was here for inline.mjs, which folds the export into one
  // self-contained heiwa-dashboard.html. It does not need it: that script
  // strips a leading "./" or "/" alike when resolving a source off disk, and
  // rewrites stylesheet references by trying every spelling of the path.
  images: { unoptimized: true },
  trailingSlash: false,
};
export default nextConfig;
