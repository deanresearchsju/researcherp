import {
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { admissionGlance, admissionOverview } from "@/data/admission";
import { eligibility } from "@/data/eligibility";

const icons: Record<string, LucideIcon> = {
  sessions: CalendarDays,
  postgraduate: GraduationCap,
  selection: ClipboardCheck,
  "part-time": Briefcase,
};

export function AdmissionOverview() {
  const copy = admissionOverview;

  return (
    <section
      id="eligibility"
      className="scroll-mt-32 py-12 sm:py-16"
      aria-labelledby="admission-overview-title"
    >
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          id="admission-overview-title"
        />
        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:grid lg:grid-cols-2">
          <article className="border-b border-border p-6 sm:p-8 lg:border-r lg:border-b-0">
            <h3 className="font-heading text-xl text-primary">{copy.eligibilityTitle}</h3>
            <ul className="mt-6 space-y-5">
              {eligibility.map((item) => {
                const Icon = icons[item.id] ?? GraduationCap;
                return (
                  <li key={item.id} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-primary">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
          <article className="bg-muted/40 p-6 sm:p-8">
            <h3 className="font-heading text-xl text-primary">{copy.processTitle}</h3>
            <ol className="mt-6">
              {admissionGlance.map((step, index) => (
                <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < admissionGlance.length - 1 ? (
                    <span
                      className="absolute top-10 bottom-0 left-5 w-px bg-border"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="pt-1">
                    <p className="font-semibold text-primary">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </Container>
    </section>
  );
}
