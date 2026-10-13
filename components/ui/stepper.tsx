import { cn } from "@/lib/utils";

type StepperProps = {
  steps: readonly string[];
  current: number;
  label?: string;
};

export function Stepper({ steps, current, label = "Progress" }: StepperProps) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1" aria-label={label}>
      {steps.map((step, index) => {
        const active = index === current;
        return (
          <li
            key={step}
            className="min-w-28 flex-1"
            aria-current={active ? "step" : undefined}
          >
            <div
              className={cn(
                "h-1 rounded-full",
                index <= current ? "bg-accent" : "bg-border",
              )}
            />
            <p
              className={cn(
                "mt-2 text-xs font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {index + 1}. {step}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
