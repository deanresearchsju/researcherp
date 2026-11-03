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
    // Every live visit is HTTPS: browsers are told to remember it for two years, for this site
    // and its sub-domains, so they never try http:// again. Browsers ignore this header on a plain
    // http answer, so a local computer (npm start on http://localhost) is not affected.
    const live =
      process.env.VERCEL || process.env.NODE_ENV === "production"
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
        // Any page asked for over plain http (behind a proxy that forwards it) is sent to the
        // same address on https. Vercel already does this at its edge; this covers any other host.
        // A local computer (localhost, 127.0.0.1) keeps working on http.
        source: "/:path*",
        has: [
          { type: "header", key: "x-forwarded-proto", value: "http" },
          {
            type: "host",
            value: String.raw`(?<host>(?!localhost|127\.0\.0\.1|\[::1\]).+)`,
          },
        ],
        destination: "https://:host/:path*",
        permanent: true,
      },
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
