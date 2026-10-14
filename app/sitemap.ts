import type { MetadataRoute } from "next";

import { university } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/admission",
    "/scholar-journey",
    "/supervisors",
    "/our-team",
    "/downloads",
    "/contact",
    "/announcements",
    "/apply",
    "/apply/status",
    "/supervisor-recognition/apply",
    "/login/scholar",
    "/login/supervisor",
    "/login/admin",
    "/privacy",
    "/terms",
  ];
  return paths.map((path) => ({
    url: `${university.siteUrl}${path || "/"}`,
    lastModified: new Date("2026-10-13"),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.6,
  }));
}
