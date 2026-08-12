/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // relative asset paths so out/index.html can be opened straight off disk
  assetPrefix: './',
  images: { unoptimized: true },
  trailingSlash: false,
};
export default nextConfig;
