import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms",
  description: `Terms for the ${university.name} research portal.`,
};

export default function TermsPage() {
  return (
    <Container className="max-w-3xl py-16">
      <h1 className="font-heading text-4xl text-primary">Terms</h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        Use of the research portal follows the terms issued by {university.name}. Fees,
        eligibility, and milestone rules remain those notified by the{" "}
        {university.researchOffice}.
      </p>
    </Container>
  );
}
