import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { SupervisorCard } from "@/components/supervisors/SupervisorCard";
import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";
import { publicSupervisor, publicSupervisors } from "@/lib/public-supervisors";
import { breadcrumbNode, clip, personNode, siteUrl } from "@/lib/seo";

export async function generateStaticParams() {
  const supervisors = await publicSupervisors();
  // At least one entry is needed for the route to be prepared; an unknown name shows "not found".
  return supervisors.length > 0
    ? supervisors.map((item) => ({ slug: item.slug }))
    : [{ slug: "profile" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await publicSupervisor(slug);
  if (!profile) return { title: "Supervisor not found", robots: { index: false } };
  const path = `/supervisors/${profile.slug}`;
  const title = `${profile.name}${profile.designation ? `, ${profile.designation}` : ""}`;
  const description = clip(
    profile.bio ||
      `${profile.name}${profile.designation ? `, ${profile.designation}` : ""}, ${profile.department || university.name}. Area of research: ${profile.researchArea || "see profile"}.`,
  );
  const image = profile.hasPhoto
    ? [{ url: `/supervisors/photo/${profile.slug}`, alt: profile.name }]
    : [{ url: "/assets/og.jpeg", width: 1200, height: 630, alt: university.name }];
  return {
    title,
    description,
    keywords: [profile.name, "Ph.D. supervisor", profile.department, ...profile.researchArea.split(/[,;]/).map((part) => part.trim())].filter(Boolean),
    alternates: { canonical: path },
    openGraph: { type: "profile", url: path, title: `${title} | ${university.name}`, description, images: image },
    twitter: { card: profile.hasPhoto ? "summary" : "summary_large_image", title: `${title} | ${university.name}`, description, images: image.map((item) => item.url) },
  };
}

export default async function SupervisorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await publicSupervisor(slug);
  if (!profile) notFound();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "ProfilePage",
              "@id": `${siteUrl}/supervisors/${profile.slug}#page`,
              url: `${siteUrl}/supervisors/${profile.slug}`,
              inLanguage: "en-IN",
              ...(profile.updatedOn ? { dateModified: profile.updatedOn } : {}),
              mainEntity: personNode(profile),
            },
            breadcrumbNode([
              { name: "Home", path: "/" },
              { name: "Research supervisors", path: "/supervisors" },
              { name: profile.name, path: `/supervisors/${profile.slug}` },
            ]),
          ],
        }}
      />
      <PageHeader eyebrow="Faculty" title={profile.name} />
      <section className="py-10 sm:py-16" aria-label={`Profile of ${profile.name}`}>
        <Container>
          <SupervisorCard profile={profile} first linked={false} />
          <p className="mt-8">
            <Link
              href="/supervisors"
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              All research supervisors
            </Link>
          </p>
        </Container>
      </section>
    </>
  );
}
