import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      {
        source: "/supervisor-vacancy",
        destination: "/supervisors",
        permanent: true,
      },
      {
        source: "/programmes-fees",
        destination: "/programmes",
        permanent: true,
      },
      {
        source: "/research-areas",
        destination: "/#research-areas",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
