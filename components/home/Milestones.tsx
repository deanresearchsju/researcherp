import { Reveal } from "@/components/home/Reveal";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { courseWork, milestones } from "@/data/milestones";
import { sectionCopy } from "@/data/sections";

export function Milestones() {
  const copy = sectionCopy.journey;

  return (
    <section id="journey" className="py-16 sm:py-24" aria-labelledby="journey-title">
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          id="journey-title"
        />
        <div className="mt-8 rounded-xl border border-accent/60 bg-accent/15 p-5">
          <p className="font-semibold text-accent-foreground">{courseWork.deadline}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {courseWork.semesters.map((semester) => (
              <div key={semester.name} className="rounded-xl bg-white p-4">
                <h3 className="text-sm font-semibold text-primary">{semester.name}</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {semester.papers.map((paper) => (
                    <li key={paper}>{paper}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <ol className="relative mt-8 space-y-4 border-l border-accent pl-6">
          {milestones.map((step, index) => (
            <Reveal key={step.id} delay={index * 0.03}>
              <li className="relative rounded-xl border border-border bg-card p-5 shadow-card">
                <span
                  className="absolute top-6 -left-[1.95rem] size-3 rounded-full border-2 border-accent bg-primary"
                  aria-hidden="true"
                />
                <p className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 font-heading text-xl text-primary">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {step.detail}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
