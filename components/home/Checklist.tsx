import { Reveal } from "@/components/home/Reveal";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

import { checklist } from "@/data/checklist";
import { sectionCopy } from "@/data/sections";

export function Checklist() {
  const documents = sectionCopy.documents;
  const requiredCount = checklist.filter((item) => item.required).length;
  const optionalCount = checklist.length - requiredCount;

  return (
    <section
      id="documents"
      className="bg-white py-16 sm:py-24"
      aria-labelledby="documents-title"
    >
      <Container>
        <SectionHeading
          eyebrow={documents.eyebrow}
          title={documents.title}
          id="documents-title"
        />
        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
            <dd className="grid size-14 place-items-center rounded-full bg-secondary font-heading text-2xl text-secondary-foreground">
              {requiredCount}
            </dd>
            <dt className="font-semibold text-primary">Required</dt>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card">
            <dd className="grid size-14 place-items-center rounded-full bg-primary font-heading text-2xl text-primary-foreground">
              {optionalCount}
            </dd>
            <dt className="font-semibold text-primary">Optional</dt>
          </div>
        </dl>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {checklist.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.03}>
              <li className="h-full rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-primary">{item.title}</h3>
                  <Badge variant={item.required ? "maroon" : "outline"}>
                    {item.badge ?? (item.required ? "Required" : "Optional")}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.detail}
                </p>
              </li>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
