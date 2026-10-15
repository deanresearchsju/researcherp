import type { Metadata } from "next";

import { AdmissionArchive } from "@/components/portal/AdmissionArchive";
import { admissionArchiveCopy } from "@/data/admission";

export const metadata: Metadata = {
  title: admissionArchiveCopy.title,
  robots: { index: false, follow: false },
};

export default function AdmissionArchivePage() {
  return <AdmissionArchive />;
}
