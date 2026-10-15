import type { Metadata } from "next";

import { RegistrationNumbers } from "@/components/portal/RegistrationNumbers";
import { registrationCopy } from "@/data/registration";

export const metadata: Metadata = {
  title: registrationCopy.title,
  robots: { index: false, follow: false },
};

export default function RegistrationNumbersPage() {
  return <RegistrationNumbers />;
}
