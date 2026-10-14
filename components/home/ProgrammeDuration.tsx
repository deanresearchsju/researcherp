import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { researchPage } from "@/data/research-home";
import { sectionCopy } from "@/data/sections";

export function ProgrammeDuration() {
  const copy = sectionCopy.fees;

  return (
    <section
      id="programmes"
      className="scroll-mt-32 py-12 sm:py-16"
      aria-labelledby="programmes-title"
    >
      <Container>
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} id="programmes-title" />
        <ul className="mt-8 grid gap-4 lg:grid-cols-3">
          {researchPage.programmeModes.map((mode) => (
            <li
              key={mode.id}
              className="rounded-2xl border border-border bg-card p-6 shadow-card"
            >
              <p className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
                {researchPage.durationLabel}
              </p>
              <h3 className="mt-3 font-heading text-xl leading-snug text-primary">
                {mode.title}
              </h3>
              <p className="mt-1 text-sm font-semibold text-gold-ink">{mode.duration}</p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
                {mode.points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
