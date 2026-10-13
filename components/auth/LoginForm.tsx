"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Captcha, openingCaptchaAnswer } from "@/components/auth/Captcha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleProfiles } from "@/data/roles";
import { mockLogin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ROLES, type Role } from "@/types";

type LoginFormProps = {
  role: Role;
};

export function LoginForm({ role }: LoginFormProps) {
  const profile = roleProfiles[role];
  const router = useRouter();
  const [answer, setAnswer] = useState(openingCaptchaAnswer);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        identifier: z.string().trim().min(3, profile.identifierError).max(120),
        password: z.string().min(6, "Password must be at least 6 characters.").max(128),
        remember: z.boolean(),
        captcha: z
          .string()
          .trim()
          .min(1, "Enter the answer shown.")
          .refine(
            (value) => value === String(answer),
            "That answer does not match. Refresh the challenge and try again.",
          ),
      }),
    [answer, profile.identifierError],
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
    const result = await mockLogin({
      role,
      identifier: values.identifier,
      password: values.password,
      remember: values.remember,
    });
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    router.push(result.redirectTo);
  }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-border bg-card p-6 shadow-lift sm:p-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          {profile.label}
        </p>
        <h2 className="mt-2 font-heading text-3xl text-primary">{profile.title}</h2>
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
            registration={register("captcha")}
            onAnswer={setAnswer}
            onClear={() => setValue("captcha", "")}
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        {profile.footnote ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {profile.footnote.prompt}{" "}
            <Link
              href={profile.footnote.href}
              className="font-semibold text-primary hover:underline"
            >
              {profile.footnote.label}
            </Link>
          </p>
        ) : null}
      </div>
      <nav
        aria-label="Switch portal"
        className="mt-4 flex flex-wrap justify-center gap-2 text-sm"
      >
        {ROLES.map((item) => (
          <Link
            key={item}
            href={`/login/${item}`}
            aria-current={item === role ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5",
              item === role
                ? "bg-primary text-primary-foreground"
                : "bg-white text-primary hover:bg-muted",
            )}
          >
            {roleProfiles[item].label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
