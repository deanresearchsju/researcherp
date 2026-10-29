import type { Metadata } from "next";
import { connection } from "next/server";

import { HelpdeskScreen } from "@/components/portal/HelpdeskScreen";
import { loadHelpdeskMessages } from "@/lib/helpdesk";

export const metadata: Metadata = {
  title: "Helpdesk",
  robots: { index: false, follow: false },
};

export default async function AdminHelpdeskPage() {
  // The earlier website messages are read for each visit, never fixed at build time.
  await connection();
  const initial = await loadHelpdeskMessages();
  return <HelpdeskScreen initial={initial} />;
}
