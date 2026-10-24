import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { SupervisorProfiles } from "@/components/supervisors/SupervisorProfiles";
import { Container } from "@/components/ui/container";
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
      <section className="border-b border-border bg-card py-8 sm:py-10" aria-label="About our supervisors">
        <Container>
          <p className="max-w-4xl text-justify text-base leading-7 text-foreground/90">
            The Ph.D. programme of {university.name} is guided by experienced, recognised research
            supervisors across engineering, science, humanities and management. Each profile below
            gives the supervisor&apos;s designation, department, area of research, a short
            biography and the Vidwan profile, so that you can choose a research area and a guide
            that match your interest before you apply.
          </p>
          <p className="mt-3 max-w-4xl text-sm text-muted-foreground">
            Ready to begin?{" "}
            <Link href="/admission" className="font-semibold text-primary hover:underline">
              Read the Ph.D. admission details
            </Link>{" "}
            or{" "}
            <Link href="/apply" className="font-semibold text-primary hover:underline">
              apply online
            </Link>
            .
          </p>
        </Container>
      </section>
      <SupervisorProfiles profiles={supervisors} />
    </>
  );
}
