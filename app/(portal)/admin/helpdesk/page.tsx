import type { Metadata } from "next";

import { HelpdeskScreen } from "@/components/portal/HelpdeskScreen";
import { loadHelpdeskMessages } from "@/lib/helpdesk";

export const metadata: Metadata = {
  title: "Helpdesk",
  robots: { index: false, follow: false },
};

export default async function AdminHelpdeskPage() {
  const initial = await loadHelpdeskMessages();
  return <HelpdeskScreen initial={initial} />;
}
