import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { applicationFee, feePlans } from "@/data/fees";
import { sectionCopy } from "@/data/sections";
import { cn } from "@/lib/utils";

const feeWidth: Record<string, string> = {
  "full-time": "w-full",
  "part-time-internal": "w-3/4",
  "part-time-external": "w-3/4",
};

export function FeeCards() {
  const copy = sectionCopy.fees;

  return (
    <section
      id="programmes"
      className="scroll-mt-32 py-12 sm:py-16"
      aria-labelledby="fees-title"
    >
      <Container>
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} id="fees-title" />
        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {feePlans.map((plan) => (
            <li
              key={plan.id}
              className={cn(
                "flex h-full flex-col rounded-2xl border bg-card p-6 shadow-card",
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
              <p className="mt-6 font-heading text-4xl text-primary">{plan.annualFee}</p>
              <p className="text-sm text-muted-foreground">
                {plan.period} · {plan.duration}
              </p>
              <div
                className="mt-4 h-3 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    plan.featured ? "bg-accent" : "bg-primary",
                    feeWidth[plan.id] ?? "w-full",
                  )}
                />
              </div>
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
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-accent bg-muted/70 p-5 sm:flex-row sm:items-center">
          <p className="grid size-16 shrink-0 place-items-center rounded-full bg-accent font-heading text-lg text-accent-foreground">
            {applicationFee.amount}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
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
