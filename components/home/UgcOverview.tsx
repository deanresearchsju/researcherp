import {
  ArrowRight,
  Award,
  BookOpenCheck,
  ClipboardCheck,
  FileSearch,
  GraduationCap,
  Landmark,
  Presentation,
  Repeat,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { AdmissionNotice } from "@/components/home/AdmissionNotice";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  ugcAdmission,
  ugcDuration,
  ugcEligibility,
  ugcHighlights,
  ugcJourney,
  ugcSource,
  ugcSupervision,
} from "@/data/ugc-norms";
import { university } from "@/lib/constants";

const stepIcons: LucideIcon[] = [
  ClipboardCheck,
  BookOpenCheck,
  Users,
  Repeat,
  Presentation,
  FileSearch,
  Landmark,
  Award,
];

/**
 * The Ph.D. programme as the UGC Regulations, 2022 lay it down: what the programme offers, who
 * can apply (including the four-year bachelor's degree), how admission is made, the stages to
 * the degree, the time allowed and supervision.
 */
export function UgcOverview() {
  return (
    <>
      <section className="bg-card py-10 sm:py-12" aria-labelledby="ugc-overview-title">
        <Container>
          <SectionHeading
            compact
            eyebrow="Ph.D. programme · UGC Regulations, 2022"
            title="The Ph.D. at a glance"
            id="ugc-overview-title"
          />
          <p className="mt-3 text-justify hyphens-auto text-sm leading-6 text-muted-foreground">
            {university.name} offers the Ph.D. under the {ugcSource.title}, in two
            admission sessions each year, January and July.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ugcHighlights.map((item) => (
              <li
                key={item.label}
                className="rounded-xl border border-border bg-background p-5 shadow-card"
              >
                <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-secondary uppercase">
                  {item.label}
                </p>
                <p className="mt-2 font-heading text-3xl font-semibold text-primary">
                  {item.value}
                </p>
                <p className="mt-1.5 text-justify text-sm leading-6 text-muted-foreground">
                  {item.detail}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-10 sm:py-12" aria-labelledby="ugc-eligibility-title">
        <Container>
          <SectionHeading
            compact
            eyebrow="Eligibility"
            title={ugcEligibility.title}
            id="ugc-eligibility-title"
          />
          <p className="mt-3 text-justify hyphens-auto text-sm leading-6 text-muted-foreground">
            {ugcEligibility.intro}
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ugcEligibility.routes.map((route) => (
              <li
                key={route.id}
                className={`flex items-start justify-between gap-4 rounded-xl border p-4 shadow-card ${
                  route.id === "bachelor-4"
                    ? "border-accent/60 bg-accent/10"
                    : "border-border bg-card"
                }`}
              >
                <div className="min-w-0">
                  <span className="mb-2 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap className="size-4" aria-hidden="true" />
                  </span>
                  <p className="font-semibold text-primary">{route.qualification}</p>
                  <p className="mt-1 text-justify text-sm leading-6 text-muted-foreground">
                    {route.after}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-heading text-3xl font-semibold text-primary">
                    {route.marks}
                  </p>
                  <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                    {route.marks === "Equivalent" ? "grade" : "marks"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-justify hyphens-auto text-sm leading-6 text-foreground/90">
            {ugcEligibility.relaxation}
          </p>
        </Container>
      </section>

      <section className="bg-card py-10 sm:py-12" aria-labelledby="ugc-admission-title">
        <Container>
          <SectionHeading
            compact
            eyebrow="Admission"
            title={ugcAdmission.title}
            id="ugc-admission-title"
          />
          <p className="mt-3 text-justify hyphens-auto text-sm leading-6 text-muted-foreground">
            {ugcAdmission.intro}
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            {ugcAdmission.routes.map((route, index) => (
              <div key={route.id} className="contents">
                {index === 1 ? (
                  <div className="grid place-items-center text-sm font-bold tracking-[0.2em] text-secondary">
                    OR
                  </div>
                ) : null}
                <div className="rounded-xl border border-border bg-background p-5 shadow-card">
                  <p className="font-heading text-lg font-semibold text-primary">
                    {route.title}
                  </p>
                  <ul className="mt-3 space-y-2 text-justify text-sm leading-6 text-muted-foreground">
                    {route.points.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-accent/60 bg-accent/10 p-5 shadow-card">
            <p className="font-heading text-lg font-semibold text-primary">Selection</p>
            <ul className="mt-3 space-y-2 text-justify text-sm leading-6 text-foreground/90">
              {ugcAdmission.selection.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-12" aria-labelledby="ugc-journey-title">
        <Container>
          <SectionHeading
            compact
            eyebrow="Programme"
            title={ugcJourney.title}
            id="ugc-journey-title"
          />
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ugcJourney.steps.map((step, index) => {
              const Icon = stepIcons[index] ?? ScrollText;
              return (
                <li
                  key={step.title}
                  className="relative rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                    <Icon className="size-5 text-secondary" aria-hidden="true" />
                  </div>
                  <p className="mt-3 font-semibold text-primary">{step.title}</p>
                  <p className="mt-1.5 text-justify text-sm leading-6 text-muted-foreground">
                    {step.detail}
                  </p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      <section className="bg-card py-10 sm:py-12" aria-labelledby="ugc-rules-title">
        <Container>
          <h2 id="ugc-rules-title" className="sr-only">
            Duration, leave and supervision
          </h2>
          <div className="grid gap-8 lg:grid-cols-2">
            {[ugcDuration, ugcSupervision].map((block) => (
              <div key={block.title}>
                <SectionHeading compact eyebrow="Regulations" title={block.title} />
                <dl className="mt-5 divide-y divide-border rounded-xl border border-border bg-background shadow-card">
                  {block.items.map((item) => (
                    <div key={item.label} className="px-4 py-3">
                      <dt className="text-sm font-semibold text-primary">{item.label}</dt>
                      <dd className="mt-1 text-justify text-sm leading-6 text-muted-foreground">
                        {item.text}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-10" aria-label="Apply and supervisors">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
            <AdmissionNotice />
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-primary">
              <Link
                href="/admission"
                className="inline-flex items-center gap-1 hover:underline"
              >
                Admission details <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/supervisors"
                className="inline-flex items-center gap-1 hover:underline"
              >
                Our supervisors <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
