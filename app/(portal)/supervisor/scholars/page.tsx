import type { Metadata } from "next";

import { MyScholars } from "@/components/portal/MyScholars";

export const metadata: Metadata = {
  title: "My scholars",
  robots: { index: false, follow: false },
};

export default function MyScholarsPage() {
  return <MyScholars />;
}
