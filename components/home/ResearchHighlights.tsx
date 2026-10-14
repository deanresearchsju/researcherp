import { RegulationsPanel } from "@/components/home/RegulationsPanel";
import { Container } from "@/components/ui/container";
import { regulationsTitle, researchPage } from "@/data/research-home";

export function ResearchHighlights() {
  return (
    <section className="bg-card py-8 sm:py-10" aria-labelledby="research-home-title">
      <Container>
        <h2 id="research-home-title" className="font-heading text-2xl text-primary">
          {researchPage.highlightsTitle}
        </h2>
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
            <dd className="mt-2 font-heading text-3xl text-primary">
              {researchPage.credits}
            </dd>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <dt className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
              {researchPage.marksLabel}
            </dt>
            <dd className="mt-2 font-heading text-3xl text-primary">
              {researchPage.marks}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-sm leading-6">{researchPage.onlineCourses}</p>

        <h3 className="mt-10 font-heading text-2xl text-primary">{regulationsTitle}</h3>
        <div className="mt-4">
          <RegulationsPanel />
        </div>
      </Container>
    </section>
  );
}
