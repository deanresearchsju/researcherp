import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy notice for the ${university.name} research portal.`,
};

export default function PrivacyPage() {
  return (
    <Container className="max-w-3xl py-16">
      <h1 className="font-heading text-4xl text-primary">Privacy</h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        Questions about how the research portal collects, stores, and uses scholar,
        supervisor, and applicant information can be sent to {university.email}.
      </p>
    </Container>
  );
}
