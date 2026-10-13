import { Reveal } from "@/components/home/Reveal";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { publications } from "@/data/publications";
import { sectionCopy } from "@/data/sections";

export function Publications() {
  const copy = sectionCopy.publications;

  return (
    <section
      id="publications"
      className="py-16 sm:py-24"
      aria-labelledby="publications-title"
    >
      <Container>
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          id="publications-title"
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {publications.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.05}>
              <article className="flex h-full flex-col rounded-xl border-x border-b border-border border-t-4 border-t-accent bg-card p-6 shadow-card">
                <Badge variant="outline">{item.school}</Badge>
                <h3 className="mt-4 font-heading text-xl leading-snug text-primary">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">{item.authors}</p>
                <p className="mt-auto pt-4 text-sm font-medium text-secondary">
                  {item.venue} · {item.year}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
