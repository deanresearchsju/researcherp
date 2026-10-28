import type { MetadataRoute } from "next";

import { university } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${university.name} · ${university.researchOffice}`,
    short_name: "SJU Research",
    description: `Ph.D. programmes at ${university.name}.`,
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#4b1f6f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
