import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { feeGlance } from "@/data/fees";
import { homeCopy } from "@/data/home";

export function ProgrammesGlance() {
  return (
    <section className="bg-white py-8 sm:py-10" aria-labelledby="programmes-glance-title">
      <Container>
        <SectionHeading
          eyebrow="Programmes"
          title="Programmes at a glance"
          id="programmes-glance-title"
        />
        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {feeGlance.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <h3 className="font-semibold text-primary">{item.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{item.line}</p>
              <p className="mt-2 font-heading text-xl text-primary">{item.fee}</p>
            </li>
          ))}
        </ul>
        <Link
          href="/admission#programmes"
          className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
        >
          {homeCopy.programmesLink}
        </Link>
      </Container>
    </section>
  );
}
