import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { buttonVariants } from "@/components/ui/button";
import { resetCopy } from "@/data/roles";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: resetCopy.title,
  description: resetCopy.description,
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lift sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Sign in
        </p>
        <h2 className="mt-2 font-heading text-3xl text-primary">{resetCopy.title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Password recovery by email is not connected yet. Write to {university.email}{" "}
          with your sign-in id. The office will reset the password.
        </p>
        <Link
          href="/login/scholar"
          className={buttonVariants({ className: "mt-6 w-full" })}
        >
          Back to scholar sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
