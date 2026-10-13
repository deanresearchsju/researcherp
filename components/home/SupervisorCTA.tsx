import Link from "next/link";

import { Reveal } from "@/components/home/Reveal";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { sectionCopy } from "@/data/sections";

export function SupervisorCTA() {
  const copy = sectionCopy.supervisors;

  return (
    <section
      id="supervisors"
      className="bg-white py-16 sm:py-24"
      aria-labelledby="supervisors-title"
    >
      <Container>
        <div className="grid items-center gap-8 overflow-hidden rounded-xl border border-border bg-card shadow-card lg:grid-cols-2">
          <div className="bg-primary px-6 py-10 text-primary-foreground sm:px-10">
            <p className="text-xs font-semibold tracking-[0.22em] text-accent uppercase">
              {copy.eyebrow}
            </p>
            <div className="mt-3 h-px w-12 bg-accent" aria-hidden="true" />
            <h2 id="supervisors-title" className="mt-4 font-heading text-3xl sm:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/80">
              {copy.description}
            </p>
            <Link
              href={copy.ctaHref}
              className={buttonVariants({
                variant: "gold",
                size: "lg",
                className: "mt-8",
              })}
            >
              {copy.cta}
            </Link>
          </div>
          <ol className="space-y-5 px-6 py-8 sm:px-10">
            {copy.points.map((point, index) => (
              <Reveal key={point.title} delay={index * 0.05}>
                <li className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-primary">{point.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {point.detail}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
