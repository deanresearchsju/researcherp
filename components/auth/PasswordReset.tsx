"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalHome, replacePreviewSession } from "@/lib/auth";
import { loadPortalUsers, updatePortalUser } from "@/lib/users";
import { usePreviewSession } from "@/lib/use-preview-session";

const schema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters.").max(128),
    confirm: z.string().min(6, "Repeat the new password.").max(128),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "The two passwords do not match.",
  });

type ResetValues = z.infer<typeof schema>;

export function PasswordReset() {
  const session = usePreviewSession();
  const ready = useClientReady();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ResetValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace("/");
    else if (!session.mustReset) router.replace(portalHome(session.role));
  }, [ready, session, router]);

  async function onSubmit(values: ResetValues) {
    if (!session) return;
    setFormError(null);
    const load = await loadPortalUsers();
    const user = load.users.find(
      (account) =>
        account.role === session.role &&
        account.identifier.toLowerCase() === session.identifier.toLowerCase(),
    );
    if (!user) {
      setFormError("This sign-in could not be updated. Sign in again.");
      return;
    }
    if (values.password === user.password) {
      setFormError("Choose a password that is different from the one you were given.");
      return;
    }
    const saved = await updatePortalUser(
      user,
      { name: user.name, password: values.password, mustReset: false, menus: user.menus },
      load.source,
    );
    if (!saved.ok) {
      setFormError("The new password could not be saved.");
      return;
    }
    replacePreviewSession({
      role: session.role,
      identifier: session.identifier,
      name: saved.user.name,
      mustReset: false,
    });
    router.push(portalHome(session.role));
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  if (!ready || !session?.mustReset) {
    return (
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lift sm:p-8">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-border bg-card p-6 shadow-lift sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          First sign-in
        </p>
        <h2 className="mt-2 font-heading text-3xl text-primary">Choose a password</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Set a new password before opening the portal. It replaces the password you were
          given.
        </p>
        {session.role === "scholar" ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            After you save it, open Personal details and fill anything that is still
            blank.
          </p>
        ) : null}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError ? (
            <p
              role="alert"
              className="rounded-xl bg-secondary/10 px-3 py-2 text-sm text-secondary"
            >
              {formError}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className="pr-12"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-primary hover:bg-muted"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="text-sm text-secondary">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirm)}
              aria-describedby={errors.confirm ? "confirm-error" : undefined}
              {...register("confirm")}
            />
            {errors.confirm ? (
              <p id="confirm-error" className="text-sm text-secondary">
                {errors.confirm.message}
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {isSubmitting ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
