import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Optimize for Cloudflare Pages
  experimental: {
    optimizePackageImports: ['three']
  }
};

export default nextConfig;
