import { Banknote, Network, ShieldCheck, type LucideIcon } from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { researchSupport } from "@/data/research-support";

const icons: Record<string, LucideIcon> = {
  drillbit: ShieldCheck,
  stipend: Banknote,
  irins: Network,
};

/** The similarity check, the stipend and the research profile: what the University offers scholars. */
export function ResearchSupport() {
  return (
    <section className="py-10 sm:py-12" aria-labelledby="research-support-title">
      <Container>
        <SectionHeading
          compact
          eyebrow={researchSupport.eyebrow}
          title={researchSupport.title}
          id="research-support-title"
        />
        <ul className="mt-6 grid gap-4 lg:grid-cols-3">
          {researchSupport.items.map((item) => {
            const Icon = icons[item.id] ?? ShieldCheck;
            const amount = "amount" in item ? item.amount : "";
            return (
              <li
                key={item.id}
                className="rounded-xl border border-border bg-card p-5 shadow-card"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 font-heading text-lg font-semibold text-primary">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-justify text-sm leading-6 text-foreground/90">
                  {item.lead}
                </p>
                {amount ? (
                  <p className="mt-2 font-heading text-2xl font-semibold text-primary">
                    {amount}
                  </p>
                ) : null}
                <ul className="mt-3 space-y-2 text-justify text-sm leading-6 text-muted-foreground">
                  {item.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
