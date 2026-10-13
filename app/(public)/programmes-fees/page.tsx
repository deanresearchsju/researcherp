import type { Metadata } from "next";

import { Eligibility } from "@/components/home/Eligibility";
import { FeeCards } from "@/components/home/FeeCards";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Programmes and fees",
  description: `Full-time and part-time Ph.D. fees at ${university.name}.`,
  alternates: { canonical: "/programmes-fees" },
};

export default function ProgrammesPage() {
  return (
    <>
      <FeeCards />
      <Eligibility />
    </>
  );
}
