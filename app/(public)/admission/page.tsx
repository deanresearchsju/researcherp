import type { Metadata } from "next";
import Link from "next/link";

import { AdmissionGlance } from "@/components/home/AdmissionGlance";
import { Checklist } from "@/components/home/Checklist";
import { FAQ } from "@/components/home/FAQ";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Admission",
  description: `Apply for the Ph.D. at ${university.name}.`,
  alternates: { canonical: "/admission" },
};

export default function AdmissionPage() {
  return (
    <>
      <section className="border-b border-border bg-white">
        <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
              Admissions
            </p>
            <h1 className="mt-3 font-heading text-4xl text-primary">Ph.D. admission</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
              Keep the documents below ready, then start the online application.
            </p>
          </div>
          <Link
            href="/apply"
            className={buttonVariants({
              variant: "gold",
              size: "lg",
              className: "shrink-0",
            })}
          >
            Apply for Ph.D.
          </Link>
        </Container>
      </section>
      <AdmissionGlance />
      <Checklist />
      <FAQ />
    </>
  );
}
