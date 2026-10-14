import { ChevronDown, ChevronRight } from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { admissionGlance } from "@/data/admission";
import { sectionCopy } from "@/data/sections";

export function AdmissionGlance() {
  return (
    <section
      className="scroll-mt-32 bg-white py-12 sm:py-16"
      aria-labelledby="admission-glance-title"
    >
      <Container>
        <SectionHeading
          eyebrow="Admissions"
          title="Admission in 4 steps"
          description={sectionCopy.admission.description}
          id="admission-glance-title"
        />
        <ol className="relative mt-10 grid gap-3 md:grid-cols-4 md:gap-6">
          <span
            className="absolute top-7 right-[12%] left-[12%] hidden h-0.5 bg-accent md:block"
            aria-hidden="true"
          />
          {admissionGlance.map((step, index) => (
            <li key={step.id} className="relative flex flex-col items-center">
              {index > 0 ? (
                <ChevronDown
                  className="mb-1 size-5 text-accent md:hidden"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-10 grid size-14 place-items-center rounded-full bg-primary font-heading text-xl text-primary-foreground shadow-lift">
                {index + 1}
              </span>
              {index < admissionGlance.length - 1 ? (
                <ChevronRight
                  className="absolute top-4 -right-4 hidden size-5 text-secondary md:block"
                  aria-hidden="true"
                />
              ) : null}
              <div className="mt-4 w-full rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-card">
                <h3 className="font-heading text-lg leading-snug text-primary">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
