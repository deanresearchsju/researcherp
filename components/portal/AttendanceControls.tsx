"use client";

import { Button } from "@/components/ui/button";

export type Mark = "Present" | "Absent" | "";

/**
 * The Present / Absent pair used wherever attendance is taken. Pressing the chosen button
 * again clears the mark.
 */
export function MarkButtons({
  name,
  value,
  onChange,
  disabled = false,
}: {
  name: string;
  value: Mark;
  onChange: (next: Mark) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label={`Attendance for ${name}`}>
      <Button
        type="button"
        size="sm"
        variant={value === "Present" ? "default" : "outline"}
        aria-pressed={value === "Present"}
        disabled={disabled}
        onClick={() => onChange(value === "Present" ? "" : "Present")}
      >
        Present
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "Absent" ? "maroon" : "outline"}
        aria-pressed={value === "Absent"}
        disabled={disabled}
        onClick={() => onChange(value === "Absent" ? "" : "Absent")}
      >
        Absent
      </Button>
    </div>
  );
}

/** "Present 9 · Absent 1 · Not marked 2" for a list of marks. */
export function markSummary(marks: readonly Mark[]) {
  const count = (value: Mark) => marks.filter((mark) => mark === value).length;
  return `Present ${count("Present")} · Absent ${count("Absent")} · Not marked ${count("")}`;
}
