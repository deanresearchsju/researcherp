import type { Metadata } from "next";

import { AdmissionGlance } from "@/components/home/AdmissionGlance";
import { Hero } from "@/components/home/Hero";
import { LatestAnnouncements } from "@/components/home/LatestAnnouncements";
import { ProgrammesGlance } from "@/components/home/ProgrammesGlance";
import { QuickAccess } from "@/components/home/QuickAccess";
import { SchoolsPreview } from "@/components/home/SchoolsPreview";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Ph.D. programmes",
  description: `Apply for a Ph.D. at ${university.name}. Research schools, programmes, fees, and admissions.`,
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
      <QuickAccess />
      <SchoolsPreview />
      <ProgrammesGlance />
      <AdmissionGlance />
      <LatestAnnouncements />
    </>
  );
}
