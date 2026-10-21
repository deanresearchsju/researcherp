import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    proxyClientMaxBodySize: "16mb",
  },
  async redirects() {
    return [
      {
        source: "/supervisor-vacancy",
        destination: "/supervisors",
        permanent: true,
      },
      {
        source: "/programmes",
        destination: "/admission#programmes",
        permanent: true,
      },
      {
        source: "/programmes-fees",
        destination: "/admission#programmes",
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
