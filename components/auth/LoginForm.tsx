"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useClientReady } from "@/components/forms/ClientGate";
import { Captcha, rollChallenge, type Challenge } from "@/components/auth/Captcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleProfiles } from "@/data/roles";
import { mockLogin } from "@/lib/auth";
import { signOutReasons } from "@/lib/use-sign-in-watch";
import type { Role } from "@/types";

type LoginFormProps = {
  role: Role;
};

export function LoginForm({ role }: LoginFormProps) {
  const profile = roleProfiles[role];
  const router = useRouter();
  const ready = useClientReady();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const search = useSyncExternalStore(
    () => () => undefined,
    () => window.location.search,
    () => "",
  );
  const notice = signOutReasons[new URLSearchParams(search).get("reason") ?? ""] ?? null;
  const [signingIn, setSigningIn] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        identifier: z
          .string()
          .trim()
          .min(3, profile.identifierError)
          .max(120)
          .refine(
            (value) => role !== "scholar" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            profile.identifierError,
          ),
        password: z.string().min(6, "Password must be at least 6 characters.").max(128),
        remember: z.boolean(),
        captcha: z
          .string()
          .trim()
          .min(1, "Enter the answer shown.")
          .refine(
            (value) => challenge !== null && value === String(challenge.answer),
            "That answer does not match. Refresh the challenge and try again.",
          ),
      }),
    [challenge, profile.identifierError, role],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      password: "",
      remember: false,
      captcha: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSigningIn(true);
    const result = await mockLogin({
      role,
      identifier: values.identifier,
      password: values.password,
      remember: values.remember,
    });
    if (!result.ok) {
      setSigningIn(false);
      setFormError(result.message);
      return;
    }
    // A full page load, so nothing of an earlier sign-in is left in the browser's memory.
    window.location.assign(result.redirectTo);
  }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;

  if (ready && challenge === null) {
    setChallenge(rollChallenge());
  }

  function refreshCaptcha() {
    setChallenge(rollChallenge());
    setValue("captcha", "");
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-border bg-card p-6 shadow-lift sm:p-8">
        {profile.label && role !== "admin" ? (
          <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
            {profile.label}
          </p>
        ) : null}
        <h2
          className={
            profile.label && role !== "admin"
              ? "mt-2 font-heading text-3xl text-primary"
              : "font-heading text-3xl text-primary"
          }
        >
          {profile.title}
        </h2>
        {notice ? (
          <p
            role="status"
            className="mt-4 rounded-xl bg-primary/5 px-3 py-2 text-sm text-primary"
          >
            {notice}
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
            <Label htmlFor="identifier">{profile.identifierLabel}</Label>
            <Input
              id="identifier"
              autoComplete="username"
              autoFocus
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={errors.identifier ? "identifier-error" : undefined}
              {...register("identifier")}
            />
            {errors.identifier ? (
              <p id="identifier-error" className="text-sm text-secondary">
                {errors.identifier.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
          <Captcha
            challenge={challenge}
            registration={register("captcha")}
            onRefresh={refreshCaptcha}
            error={errors.captcha?.message}
          />
          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                {...register("remember")}
              />
              Remember me
            </label>
            <Link
              href="/login/forgot"
              className="font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={signingIn}
            aria-busy={signingIn}
          >
            {signingIn ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {signingIn ? "Signing in…" : "Sign in"}
          </Button>
          {profile.footnote ? (
            <p className="text-center text-sm text-muted-foreground">
              {profile.footnote.prompt}{" "}
              <Link
                href={profile.footnote.href}
                className="font-medium text-primary hover:underline"
              >
                {profile.footnote.label}
              </Link>
              {profile.footnote.secondary ? (
                <>
                  {" · "}
                  <Link
                    href={profile.footnote.secondary.href}
                    className="font-medium text-primary hover:underline"
                  >
                    {profile.footnote.secondary.label}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
