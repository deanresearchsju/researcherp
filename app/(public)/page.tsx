import type { Metadata } from "next";

import { Hero } from "@/components/home/Hero";
import { ResearchAreas } from "@/components/home/ResearchAreas";
import { ResearchHighlights } from "@/components/home/ResearchHighlights";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Ph.D. programmes",
  description: `Apply for a Ph.D. at ${university.name}. Two admission sessions each year: January and July.`,
  alternates: { canonical: "/" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "CollegeOrUniversity",
  name: university.name,
  slogan: university.tagline,
  email: university.email,
  telephone: university.phoneDisplay,
  url: university.siteUrl,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <ResearchHighlights />
      <ResearchAreas />
    </>
  );
}
