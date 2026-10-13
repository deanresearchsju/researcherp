import type { Metadata } from "next";

import { NewsManager } from "@/components/portal/NewsManager";

export const metadata: Metadata = {
  title: "News and events",
  robots: { index: false, follow: false },
};

export default function AdminNewsPage() {
  return <NewsManager />;
}
