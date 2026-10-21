import type { Metadata } from "next";

import { Contact } from "@/components/home/Contact";
import { ContactForm } from "@/components/home/ContactForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/container";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: `Write to the ${university.researchOffice} at ${university.email}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const copy = pageHeroes.contact;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <Container className="py-8 sm:py-10">
        <div className="space-y-6">
          <ContactForm />
          <Contact />
        </div>
      </Container>
    </>
  );
}
