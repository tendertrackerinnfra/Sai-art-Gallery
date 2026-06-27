import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@prisma/client/**/*",
      "./node_modules/.prisma/client/**/*",
    ],
  },
};

export default nextConfig;
