import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { eligibility } from "@/data/eligibility";

export function Eligibility() {
  return (
    <section className="pb-16" aria-labelledby="eligibility-title">
      <Container>
        <SectionHeading
          eyebrow="Eligibility"
          title="Who may apply"
          id="eligibility-title"
        />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {eligibility.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <h3 className="font-semibold text-primary">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
