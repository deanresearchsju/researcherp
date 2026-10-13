import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";
import { roleProfiles } from "@/data/roles";
import { ROLES, type Role } from "@/types";

type LoginPageProps = {
  params: Promise<{ role: string }>;
};

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return ROLES.map((role) => ({ role }));
}

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { role } = await params;
  if (!isRole(role)) return { title: "Sign in" };
  return {
    title: roleProfiles[role].title,
    description: roleProfiles[role].description,
  };
}

export default function LoginPage({ params }: LoginPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginContent params={params} />
    </Suspense>
  );
}

async function LoginContent({ params }: LoginPageProps) {
  const { role } = await params;
  if (!isRole(role)) notFound();

  return (
    <AuthLayout>
      <LoginForm key={role} role={role} />
    </AuthLayout>
  );
}
