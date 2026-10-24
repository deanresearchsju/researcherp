import type { MetadataRoute } from "next";

import { university } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/scholar/", "/supervisor/", "/admin/", "/login/", "/api/"],
    },
    sitemap: `${university.siteUrl}/sitemap.xml`,
  };
}
