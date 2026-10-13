import { Reveal } from "@/components/home/Reveal";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import Link from "next/link";

import { checklist } from "@/data/checklist";
import { sectionCopy } from "@/data/sections";

export function Checklist() {
  const documents = sectionCopy.documents;
  const files = sectionCopy.downloads;

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
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <p className="mt-8 text-sm">
          <Link href="/downloads" className="font-semibold text-primary hover:underline">
            {files.title}
          </Link>
        </p>
      </Container>
    </section>
  );
}
