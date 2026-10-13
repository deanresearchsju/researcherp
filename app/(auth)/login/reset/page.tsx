import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordReset } from "@/components/auth/PasswordReset";

export const metadata: Metadata = {
  title: "Choose a password",
  description: "Set a new password before opening the research portal.",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthLayout>
        <PasswordReset />
      </AuthLayout>
    </Suspense>
  );
}
