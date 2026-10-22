import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/*": ["./.rent-sync-dev-data.json"],
  },
  outputFileTracingIncludes: {
    "/api/owner/agreements/*/pdf": [
      "./rentagrimentformat-blank.pdf",
      "./assets/fonts/NotoSansMalayalam-Regular.ttf",
    ],
  },
};

export default nextConfig;
