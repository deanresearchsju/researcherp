import type { NextConfig } from "next";

/**
 * What a page may load. The browser talks only to this site (the database is reached through
 * /api/db), so connections, forms and frames are limited to it. Scripts and styles still allow
 * inline code because Next.js writes its start-up script into every page.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      // A local computer in development needs live reload, which this policy would block.
      ...(process.env.NODE_ENV !== "development"
        ? [
            {
              key: "Content-Security-Policy",
              // On the live site (HTTPS only) a stray http:// link is upgraded to https://.
              value: process.env.VERCEL
                ? `${contentSecurityPolicy}; upgrade-insecure-requests`
                : contentSecurityPolicy,
            },
          ]
        : []),
    ];
    // On the live site (Vercel) every visit is HTTPS: browsers are told to remember it and to
    // upgrade any stray http:// link. Not set on a local computer, which runs on http.
    const live = process.env.VERCEL
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : [];
    return [{ source: "/:path*", headers: [...secure, ...live] }];
  },
  async redirects() {
    return [
      {
        // The public Contact page was closed: questions are asked inside the ERP.
        source: "/contact",
        destination: "/",
        permanent: true,
      },
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
