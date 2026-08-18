/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Static exports need relative paths; the development client must resolve
  // its hydration assets from the dev server root.
  assetPrefix: process.env.NODE_ENV === "production" ? "./" : undefined,
  images: { unoptimized: true },
  trailingSlash: false,
};
export default nextConfig;
