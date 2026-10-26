import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { SupervisorProfiles } from "@/components/supervisors/SupervisorProfiles";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";
import { publicSupervisors } from "@/lib/public-supervisors";
import { supervisorJsonLd } from "@/lib/seo";

const path = "/supervisors";

export async function generateMetadata(): Promise<Metadata> {
  const supervisors = await publicSupervisors();
  const count = supervisors.length;
  const title = "Ph.D. Research Supervisors and Areas of Research";
  const description = `Meet the ${count > 0 ? `${count} ` : ""}recognised Ph.D. research supervisors of ${university.name}, Chennai: their areas of research, biographies and Vidwan profiles. Find a guide for your doctoral research.`;
  const keywords = [
    "Ph.D. supervisors",
    "research guides",
    `${university.name} research supervisors`,
    `Ph.D. admission ${university.name}`,
    "doctoral research Chennai",
    "Vidwan profile",
    ...supervisors.flatMap((item) => item.researchArea.split(/[,;]/).map((part) => part.trim())),
  ]
    .filter(Boolean)
    .slice(0, 25);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: `${title} | ${university.name}`,
      description,
      images: [{ url: "/assets/og.jpeg", width: 1200, height: 630, alt: `${university.name} research supervisors` }],
    },
    twitter: { card: "summary_large_image", title: `${title} | ${university.name}`, description, images: ["/assets/og.jpeg"] },
  };
}

export default async function SupervisorsPage() {
  const copy = pageHeroes.supervisors;
  const supervisors = await publicSupervisors();
  return (
    <>
      <JsonLd data={supervisorJsonLd(supervisors)} />
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <SupervisorProfiles profiles={supervisors} />
    </>
  );
}
