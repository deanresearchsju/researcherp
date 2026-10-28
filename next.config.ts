import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    proxyClientMaxBodySize: "16mb",
  },
  async headers() {
    const secure = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
    ];
    // On the live site (Vercel) every visit is HTTPS: browsers are told to remember it and to
    // upgrade any stray http:// link. Not set on a local computer, which runs on http.
    const live = process.env.VERCEL
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: "upgrade-insecure-requests" },
        ]
      : [];
    return [{ source: "/:path*", headers: [...secure, ...live] }];
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
        source: "/scholar-journey",
        destination: "/",
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
