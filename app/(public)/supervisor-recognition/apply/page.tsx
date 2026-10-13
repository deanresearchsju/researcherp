import type { Metadata } from "next";

import { ClientGate } from "@/components/forms/ClientGate";
import { SupervisorApplication } from "@/components/forms/supervisor/SupervisorApplication";
import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Supervisor recognition",
  description: `Apply for recognition as a research supervisor at ${university.name}.`,
  alternates: { canonical: "/supervisor-recognition/apply" },
};

export default function SupervisorApplyPage() {
  return (
    <Container className="py-8 sm:py-10">
      <ClientGate>
        <SupervisorApplication />
      </ClientGate>
    </Container>
  );
}
