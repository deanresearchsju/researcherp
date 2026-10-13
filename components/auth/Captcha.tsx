"use client";

import { RefreshCw } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Challenge = {
  left: number;
  right: number;
  answer: number;
};

type CaptchaProps = {
  challenge: Challenge | null;
  registration: UseFormRegisterReturn<"captcha">;
  onRefresh: () => void;
  error?: string;
};

export function rollChallenge(): Challenge {
  const left = 2 + Math.floor(Math.random() * 8);
  const right = 1 + Math.floor(Math.random() * 8);
  return { left, right, answer: left + right };
}

export function Captcha({ challenge, registration, onRefresh, error }: CaptchaProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="captcha">
        {challenge
          ? `What is ${challenge.left} + ${challenge.right}?`
          : "Preparing the sign-in check"}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id="captcha"
          inputMode="numeric"
          autoComplete="off"
          disabled={!challenge}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "captcha-error" : undefined}
          {...registration}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          onClick={onRefresh}
          disabled={!challenge}
          aria-label="Refresh captcha"
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
      {error ? (
        <p id="captcha-error" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </div>
  );
}
