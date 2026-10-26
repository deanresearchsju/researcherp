import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/container";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms for the ${university.name} research portal.`,
};

export default function TermsPage() {
  const copy = pageHeroes.terms;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <Container className="max-w-3xl py-8 sm:py-10">
        <p className="text-sm leading-7 text-muted-foreground">
          Use of the research portal follows the terms issued by {university.name}. Fees,
          eligibility, and milestone rules remain those notified by the{" "}
          {university.researchOffice}. How personal information is handled is described on
          the{" "}
          <Link href="/privacy" className="font-semibold text-primary underline">
            privacy page
          </Link>
          .
        </p>
      </Container>
    </>
  );
}
