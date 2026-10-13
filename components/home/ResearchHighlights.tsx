import { RegulationsPanel } from "@/components/home/RegulationsPanel";
import { Container } from "@/components/ui/container";
import { regulationsTitle, researchPage } from "@/data/research-home";

export function ResearchHighlights() {
  return (
    <section className="bg-white py-8 sm:py-10" aria-labelledby="research-home-title">
      <Container>
        <h2
          id="research-home-title"
          className="font-heading text-3xl font-semibold text-primary sm:text-4xl"
        >
          {researchPage.title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          {researchPage.summary}
        </p>

        <h3 className="mt-10 font-heading text-2xl text-primary">{researchPage.highlightsTitle}</h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <dt className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
              {researchPage.durationLabel}
            </dt>
            {researchPage.duration.map((line) => (
              <dd key={line} className="mt-2 text-sm font-semibold text-primary">
                {line}
              </dd>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <dt className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
              {researchPage.creditsLabel}
            </dt>
            <dd className="mt-2 font-heading text-3xl text-primary">{researchPage.credits}</dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <dt className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
              {researchPage.marksLabel}
            </dt>
            <dd className="mt-2 font-heading text-3xl text-primary">{researchPage.marks}</dd>
          </div>
        </dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6">
          {researchPage.extensions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-6">{researchPage.teaching}</p>
        <p className="mt-2 text-sm leading-6">{researchPage.onlineCourses}</p>

        <h3 className="mt-10 font-heading text-2xl text-primary">{regulationsTitle}</h3>
        <div className="mt-4">
          <RegulationsPanel />
        </div>
      </Container>
    </section>
  );
}
