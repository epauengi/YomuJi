import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: { '/api/jlpt': ['./data/jlpt/*.json'], '/api/parse': ['./node_modules/kuromoji/dict/*'] },
  serverExternalPackages: ['kuromoji'],
};

export default nextConfig;
