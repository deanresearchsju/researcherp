"use client";

import { researchWordLimit } from "@/lib/constants";
import { wordCount } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

type WordCountTextareaProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

export function WordCountTextarea({
  id,
  value,
  onChange,
  invalid = false,
}: WordCountTextareaProps) {
  const count = wordCount(value);
  const within = count >= researchWordLimit.min && count <= researchWordLimit.max;
  return (
    <div className="space-y-1.5">
      <Textarea
        id={id}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-count`}
        onChange={(event) => onChange(event.target.value)}
      />
      <p
        id={`${id}-count`}
        className={cn("text-xs", within ? "text-muted-foreground" : "text-secondary")}
      >
        {count} words
      </p>
    </div>
  );
}
