import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { buttonVariants } from "@/components/ui/button";
import { resetCopy } from "@/data/roles";

export const metadata: Metadata = {
  title: resetCopy.title,
  description: resetCopy.description,
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      welcome={resetCopy.welcome}
      description={resetCopy.description}
      benefits={resetCopy.benefits}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lift">
        <h2 className="font-heading text-3xl text-primary">{resetCopy.title}</h2>
        <Link href="/login/scholar" className={buttonVariants({ className: "mt-6" })}>
          Back to scholar sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
