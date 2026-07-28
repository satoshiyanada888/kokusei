import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  htmlLimitedBots: /.*/,
  images: {
    // Keep the optimizer disabled until the runtime sharp version includes a
    // reviewed fix for GHSA-f88m-g3jw-g9cj.
    unoptimized: true,
  },
};

export default nextConfig;
