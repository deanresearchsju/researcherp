import type { Metadata } from "next";

import { QueryDesk } from "@/components/portal/QueryDesk";

export const metadata: Metadata = {
  title: "Helpdesk",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <QueryDesk role="scholar" />;
}
