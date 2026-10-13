"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Challenge = {
  left: number;
  right: number;
  answer: number;
};

type CaptchaProps = {
  registration: UseFormRegisterReturn<"captcha">;
  onAnswer: (answer: number) => void;
  onClear: () => void;
  error?: string;
};

const openingChallenge: Challenge = { left: 4, right: 5, answer: 9 };

export const openingCaptchaAnswer = openingChallenge.answer;

function roll(): Challenge {
  const left = 2 + Math.floor(Math.random() * 8);
  const right = 1 + Math.floor(Math.random() * 8);
  return { left, right, answer: left + right };
}

export function Captcha({ registration, onAnswer, onClear, error }: CaptchaProps) {
  const [challenge, setChallenge] = useState(openingChallenge);

  function refresh() {
    const next = roll();
    setChallenge(next);
    onAnswer(next.answer);
    onClear();
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="captcha">
        What is {challenge.left} + {challenge.right}?
      </Label>
      <div className="flex gap-2">
        <Input
          id="captcha"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "captcha-error" : undefined}
          {...registration}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={refresh}
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
