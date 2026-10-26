import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Strip console noise from production builds, keep real error reporting
  compiler: {
    removeConsole: { exclude: ['error', 'warn'] }
  },
  // Optimize for Cloudflare Pages
  experimental: {
    optimizePackageImports: ['three']
  }
};

export default nextConfig;
