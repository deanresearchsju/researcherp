import type { Metadata } from "next";

import { EvaluatorScreen } from "@/components/portal/EvaluatorScreen";

export const metadata: Metadata = {
  title: "Thesis evaluators",
  robots: { index: false, follow: false },
};

export default function AdminEvaluatorsPage() {
  return <EvaluatorScreen mode="admin" />;
}
