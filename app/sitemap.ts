import type { MetadataRoute } from "next";

import { university } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/admission",
    "/supervisors",
    "/our-team",
    "/downloads",
    "/contact",
    "/announcements",
    "/apply",
    "/apply/status",
    "/supervisor-recognition/apply",
    "/supervisor-recognition/status",
    "/terms",
    "/privacy",
  ];
  const pages: MetadataRoute.Sitemap = paths.map((path) => ({
    url: `${university.siteUrl}${path || "/"}`,
    lastModified: new Date("2026-10-13"),
    changeFrequency: path === "" || path === "/supervisors" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/supervisors" ? 0.9 : 0.6,
  }));
  return pages;
}
