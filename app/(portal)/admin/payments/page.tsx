import type { Metadata } from "next";

import { PaymentApprovalsScreen } from "@/components/portal/PaymentApprovalsScreen";

export const metadata: Metadata = {
  title: "Payment approvals",
  robots: { index: false, follow: false },
};

export default function PaymentApprovalsPage() {
  return <PaymentApprovalsScreen />;
}
