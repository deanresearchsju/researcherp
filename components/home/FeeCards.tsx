import { Check } from "lucide-react";

import { Reveal } from "@/components/home/Reveal";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { applicationFee, feePlans } from "@/data/fees";
import { sectionCopy } from "@/data/sections";
import { cn } from "@/lib/utils";

export function FeeCards() {
  const copy = sectionCopy.fees;

  return (
    <section
      id="programmes"
      className="bg-white py-16 sm:py-24"
      aria-labelledby="fees-title"
    >
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          id="fees-title"
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {feePlans.map((plan, index) => (
            <Reveal key={plan.id} delay={index * 0.05}>
              <article
                className={cn(
                  "flex h-full flex-col rounded-xl border bg-card p-6 shadow-card",
                  plan.featured ? "border-primary" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-2xl text-primary">{plan.name}</h3>
                  {plan.featured ? <Badge variant="gold">Full time</Badge> : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {plan.summary}
                </p>
                <p className="mt-6 font-heading text-4xl text-primary">
                  {plan.annualFee}
                </p>
                <p className="text-sm text-muted-foreground">
                  {plan.period} · {plan.duration}
                </p>
                <ul className="mt-6 space-y-3">
                  {plan.points.map((point) => (
                    <li key={point} className="flex gap-2 text-sm leading-6">
                      <Check
                        className="mt-1 size-4 shrink-0 text-secondary"
                        aria-hidden="true"
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-border bg-muted/70 p-5 text-sm leading-6 text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">
              Application fee {applicationFee.amount}.
            </span>{" "}
            {applicationFee.detail}
          </p>
        </div>
      </Container>
    </section>
  );
}
