import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { admissionGlance } from "@/data/admission";
import { homeCopy } from "@/data/home";

export function AdmissionGlance() {
  return (
    <section className="py-8 sm:py-10" aria-labelledby="admission-glance-title">
      <Container>
        <SectionHeading
          eyebrow="Admissions"
          title="Admission in 4 steps"
          id="admission-glance-title"
        />
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {admissionGlance.map((step, index) => (
            <li
              key={step.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <span className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
                {index + 1}
              </span>
              <h3 className="mt-2 font-semibold text-primary">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            </li>
          ))}
        </ol>
        <Link
          href="/admission"
          className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          {homeCopy.admissionLink}
        </Link>
      </Container>
    </section>
  );
}
