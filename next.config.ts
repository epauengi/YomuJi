import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { '/api/jlpt': ['./data/jlpt/*.json'] },
};

export default nextConfig;
