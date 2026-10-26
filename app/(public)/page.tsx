import type { Metadata } from "next";

import { AnnouncementTicker } from "@/components/home/AnnouncementTicker";
import { Hero } from "@/components/home/Hero";
import { ResearchAreas } from "@/components/home/ResearchAreas";
import { ResearchSupport } from "@/components/home/ResearchSupport";
import { UgcOverview } from "@/components/home/UgcOverview";
import { university } from "@/lib/constants";
import { keyAreasOf } from "@/lib/department-areas";
import { registerSupervisorAreas } from "@/lib/public-supervisors";

export const metadata: Metadata = {
  title: "Ph.D. programmes",
  description: `Ph.D. at ${university.name} as per the UGC Regulations, 2022: eligibility including the four-year bachelor's degree, admission, course work, duration, supervision and thesis evaluation. Sessions in January and July.`,
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

export default async function HomePage() {
  const supervisors = await registerSupervisorAreas();
  const supervisorAreas = supervisors.map((item) => ({
    department: item.department,
    areas: keyAreasOf(item.researchArea),
  }));
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Hero />
      <AnnouncementTicker />
      <UgcOverview />
      <ResearchSupport />
      <ResearchAreas supervisorAreas={supervisorAreas} />
    </>
  );
}
