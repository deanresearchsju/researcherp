import { cn } from "@/lib/utils";

type StepperProps = {
  steps: readonly string[];
  current: number;
  label?: string;
};

export function Stepper({ steps, current, label = "Progress" }: StepperProps) {
  const total = steps.length;
  const title = steps[current] ?? "";

  return (
    <div className="sticky top-0 z-20 -mx-1 border-b border-border bg-card/95 px-1 py-2 backdrop-blur-md">
      <p className="mb-1 text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase sm:hidden">
        Step {current + 1} of {total}
        {title ? ` · ${title}` : ""}
      </p>
      <ol className="flex gap-1 overflow-x-auto pb-0.5" aria-label={label}>
        {steps.map((step, index) => {
          const active = index === current;
          const done = index < current;
          return (
            <li
              key={step}
              className="min-w-10 flex-1 sm:min-w-0"
              aria-current={active ? "step" : undefined}
            >
              <div
                className={cn(
                  "h-1 rounded-full",
                  done || active ? "bg-accent" : "bg-border",
                )}
              />
              <p
                className={cn(
                  "mt-1 truncate text-center text-[0.65rem] font-semibold sm:text-left",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="sm:hidden">{index + 1}</span>
                <span className="hidden sm:inline">
                  {index + 1}. {step}
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
