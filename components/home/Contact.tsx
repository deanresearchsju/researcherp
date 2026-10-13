import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { Container } from "@/components/ui/container";
import { sectionCopy } from "@/data/sections";
import { university } from "@/lib/constants";

export function Contact() {
  const copy = sectionCopy.contact;

  return (
    <section id="contact" className="py-16 sm:py-24" aria-labelledby="contact-title">
      <Container>
        <div className="grid gap-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
            <p className="text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
              {copy.eyebrow}
            </p>
            <div className="mt-3 h-px w-12 bg-accent" aria-hidden="true" />
            <h2
              id="contact-title"
              className="mt-4 font-heading text-3xl text-primary sm:text-4xl"
            >
              {copy.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              {copy.description}
            </p>
            <address className="mt-6 space-y-4 text-sm not-italic">
              <p className="flex gap-3">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  {university.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </p>
              <p className="flex gap-3">
                <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <a className="hover:underline" href={`mailto:${university.email}`}>
                  {university.email}
                </a>
              </p>
              <p className="flex gap-3">
                <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <a className="hover:underline" href={`tel:${university.phone}`}>
                  {university.phoneDisplay}
                </a>
              </p>
              <p className="flex gap-3">
                <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{university.hours}</span>
              </p>
            </address>
          </div>
        </div>
      </Container>
    </section>
  );
}
