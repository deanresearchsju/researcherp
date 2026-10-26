import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { admissionGlance, admissionOverview } from "@/data/admission";

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
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {admissionGlance.map((step, index) => (
            <li
              key={step.id}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <p className="mt-3 font-semibold text-primary">{step.title}</p>
              <p className="mt-1 text-justify text-sm leading-6 text-muted-foreground">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
