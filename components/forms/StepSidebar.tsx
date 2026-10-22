"use client";

import { Check } from "lucide-react";

import { Stepper } from "@/components/ui/stepper";
import { university } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * The application form's section menu: a vertical list on the left for wide screens, and the
 * compact progress bar on phones. Sections already completed can be reopened; later ones open
 * only through Save & Next, so each section is checked in order.
 */
export function StepSidebar({
  title,
  steps,
  current,
  onSelect,
}: {
  title: string;
  steps: readonly string[];
  current: number;
  onSelect?: (index: number) => void;
}) {
  const percent = Math.round((current / Math.max(steps.length - 1, 1)) * 100);
  return (
    <div className="lg:sticky lg:top-40 lg:self-start">
      <div className="lg:hidden">
        <Stepper steps={steps} current={current} />
      </div>
      <nav
        aria-label={title}
        className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-card lg:block"
      >
        <div className="border-b border-border bg-gradient-to-r from-primary to-purple-deep px-4 py-3 text-primary-foreground">
          <p className="text-[0.65rem] font-bold tracking-[0.18em] text-accent uppercase">
            {title}
          </p>
          <p className="mt-1 text-sm font-semibold">
            Section {current + 1} of {steps.length}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <ol className="p-2">
          {steps.map((step, index) => {
            const active = index === current;
            const done = index < current;
            return (
              <li key={step}>
                <button
                  type="button"
                  disabled={!done || !onSelect}
                  aria-current={active ? "step" : undefined}
                  onClick={() => onSelect?.(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                    active && "bg-primary/10 font-semibold text-primary",
                    done && "text-primary hover:bg-muted",
                    !active && !done && "cursor-default text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                      active && "bg-primary text-primary-foreground",
                      done && "bg-accent text-accent-foreground",
                      !active && !done && "border border-border bg-card",
                    )}
                  >
                    {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                  </span>
                  <span className="min-w-0 truncate">{step}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-border bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <p className="font-semibold text-primary">Need help?</p>
          <a className="break-all hover:underline" href={`mailto:${university.email}`}>
            {university.email}
          </a>
        </div>
      </nav>
    </div>
  );
}
