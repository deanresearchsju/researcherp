import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ScholarRecordScreen } from "@/components/portal/ScholarRecordScreen";
import { menuBySlug, scholarRecordMenus } from "@/data/scholar-records";

type RecordPageProps = {
  params: Promise<{ kind: string }>;
};

export function generateStaticParams() {
  return scholarRecordMenus.map((menu) => ({ kind: menu.slug }));
}

export async function generateMetadata({ params }: RecordPageProps): Promise<Metadata> {
  const { kind } = await params;
  const menu = menuBySlug(kind);
  return {
    title: menu?.label ?? "Scholar record",
    robots: { index: false, follow: false },
  };
}

async function RecordPage({ params }: RecordPageProps) {
  const { kind } = await params;
  const menu = menuBySlug(kind);
  if (!menu) notFound();
  return <ScholarRecordScreen menu={menu} mode="scholar" />;
}

export default function ScholarRecordPage({ params }: RecordPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <RecordPage params={params} />
    </Suspense>
  );
}
