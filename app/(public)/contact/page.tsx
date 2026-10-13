import type { Metadata } from "next";

import { Contact } from "@/components/home/Contact";
import { ContactForm } from "@/components/home/ContactForm";
import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: `Write to the ${university.researchOffice} at ${university.email}.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <Contact />
      <Container className="pb-16">
        <ContactForm />
      </Container>
    </>
  );
}
