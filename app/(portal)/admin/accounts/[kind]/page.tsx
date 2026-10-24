import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountsFeeScreen, type FeeKind } from "@/components/portal/AccountsFeeScreen";

const kinds: readonly FeeKind[] = [
  "registration",
  "course-work",
  "annual",
  "synopsis",
  "thesis",
];

export const metadata: Metadata = {
  title: "Fee verification",
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return kinds.map((kind) => ({ kind }));
}

export default async function AccountsFeePage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!(kinds as readonly string[]).includes(kind)) notFound();
  return <AccountsFeeScreen kind={kind as FeeKind} />;
}
