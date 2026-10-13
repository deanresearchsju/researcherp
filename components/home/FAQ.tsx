import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { faqs } from "@/data/faqs";
import { sectionCopy } from "@/data/sections";

export function FAQ() {
  const copy = sectionCopy.faq;

  return (
    <section id="faq" className="bg-white py-16 sm:py-24" aria-labelledby="faq-title">
      <Container className="max-w-3xl">
        <SectionHeading
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          align="center"
          id="faq-title"
        />
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </section>
  );
}
