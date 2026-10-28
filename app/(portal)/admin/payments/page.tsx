import type { Metadata } from "next";

import { PaymentDesk } from "@/components/portal/PaymentDesk";

export const metadata: Metadata = {
  title: "Payment approvals",
  robots: { index: false, follow: false },
};

export default function PaymentApprovalsPage() {
  return <PaymentDesk />;
}
