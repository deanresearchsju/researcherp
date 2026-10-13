import Link from "next/link";

import { Reveal } from "@/components/home/Reveal";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { admissionSteps } from "@/data/admission";
import { sectionCopy } from "@/data/sections";

export function AdmissionStepper() {
  const copy = sectionCopy.admission;

  return (
    <section id="admission" className="py-16 sm:py-24" aria-labelledby="admission-title">
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          id="admission-title"
        />
        <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {admissionSteps.map((step, index) => (
            <Reveal key={step.id} delay={index * 0.04}>
              <li className="relative h-full rounded-xl border border-border bg-card p-4 shadow-card">
                <span className="grid size-8 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-heading text-lg leading-snug text-primary">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {step.detail}
                </p>
                {index < admissionSteps.length - 1 ? (
                  <span
                    className="absolute top-8 -right-3 hidden h-px w-3 bg-accent lg:block"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            </Reveal>
          ))}
        </ol>
        <div className="mt-8">
          <Link
            href={copy.journeyHref}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {copy.journeyLabel}
          </Link>
        </div>
      </Container>
    </section>
  );
}
