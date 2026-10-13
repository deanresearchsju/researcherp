import type { Metadata } from "next";

import { ClientGate } from "@/components/forms/ClientGate";
import { ScholarApplication } from "@/components/forms/scholar/ScholarApplication";
import { Container } from "@/components/ui/container";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Ph.D. application",
  description: `Apply for the Ph.D. at ${university.name}.`,
  alternates: { canonical: "/apply" },
};

export default function ApplyPage() {
  return (
    <Container className="py-8 sm:py-10">
      <ClientGate>
        <ScholarApplication />
      </ClientGate>
    </Container>
  );
}
