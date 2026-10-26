import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  id?: string;
  light?: boolean;
  compact?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  id,
  light = false,
  compact = false,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === "center" && "mx-auto max-w-2xl text-center")}>
      {eyebrow ? (
        <>
          <p
            className={cn(
              "font-semibold tracking-[0.18em] uppercase",
              compact ? "text-[0.65rem]" : "text-xs tracking-[0.22em]",
              light ? "text-accent" : "text-secondary",
            )}
          >
            {eyebrow}
          </p>
          <div
            className={cn(
              "bg-accent",
              compact ? "mt-1.5 h-px w-8" : "mt-3 h-px w-12",
              align === "center" && "mx-auto",
            )}
            aria-hidden="true"
          />
        </>
      ) : null}
      <h2
        id={id}
        className={cn(
          "font-heading leading-tight font-semibold",
          eyebrow
            ? compact
              ? "mt-2 text-xl sm:text-2xl"
              : "mt-4 text-3xl sm:text-4xl"
            : compact
              ? "text-xl sm:text-2xl"
              : "text-3xl sm:text-4xl",
          light ? "text-white" : "text-primary",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            compact ? "mt-2 text-sm leading-5" : "mt-4 text-base leading-7",
            light ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
