import type { Metadata } from "next";

import { ResearchRegister } from "@/components/portal/ResearchRegister";

export const metadata: Metadata = {
  title: "Scholar register",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <ResearchRegister />;
}
