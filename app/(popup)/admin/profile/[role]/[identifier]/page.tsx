import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PersonProfileScreen } from "@/components/portal/PersonProfileScreen";
import { personFileCopy } from "@/data/person-file";

type ProfilePageProps = {
  params: Promise<{ role: string; identifier: string }>;
  searchParams: Promise<{ name?: string | string[] }>;
};

function asRole(value: string): "scholar" | "supervisor" | null {
  if (value === "scholar" || value === "supervisor") return value;
  return null;
}

function asName(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

export async function generateMetadata({
  params,
  searchParams,
}: ProfilePageProps): Promise<Metadata> {
  const { identifier } = await params;
  const query = await searchParams;
  const name = asName(query.name) || decodeURIComponent(identifier);
  return {
    title: `${name} · ${personFileCopy.viewProfile}`,
    robots: { index: false, follow: false },
  };
}

async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const { role: roleParam, identifier: encoded } = await params;
  const role = asRole(roleParam);
  if (!role) notFound();
  const identifier = decodeURIComponent(encoded);
  const query = await searchParams;
  const name = asName(query.name) || identifier;
  return <PersonProfileScreen role={role} identifier={identifier} name={name} />;
}

export default function AdminPersonProfilePage(props: ProfilePageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ProfilePage {...props} />
    </Suspense>
  );
}
