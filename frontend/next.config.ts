import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  htmlLimitedBots: /.*/,
};

export default nextConfig;
