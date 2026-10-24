import type { MetadataRoute } from "next";

import { university } from "@/lib/constants";
import { publicSupervisors } from "@/lib/public-supervisors";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    "/supervisor-recognition/status",
    "/terms",
  ];
  const pages: MetadataRoute.Sitemap = paths.map((path) => ({
    url: `${university.siteUrl}${path || "/"}`,
    lastModified: new Date("2026-10-13"),
    changeFrequency: path === "" || path === "/supervisors" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/supervisors" ? 0.9 : 0.6,
  }));
  const supervisors = await publicSupervisors();
  const profiles: MetadataRoute.Sitemap = supervisors.map((profile) => {
    const changed = new Date(profile.updatedOn);
    return {
      url: `${university.siteUrl}/supervisors/${profile.slug}`,
      lastModified: Number.isNaN(changed.getTime()) ? new Date("2026-10-13") : changed,
      changeFrequency: "monthly",
      priority: 0.7,
    };
  });
  return [...pages, ...profiles];
}
