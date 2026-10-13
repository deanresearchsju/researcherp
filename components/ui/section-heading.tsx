import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  id?: string;
  light?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  id,
  light = false,
}: SectionHeadingProps) {
  return (
    <div className={cn(align === "center" && "mx-auto max-w-2xl text-center")}>
      <p
        className={cn(
          "text-xs font-semibold tracking-[0.22em] uppercase",
          light ? "text-accent" : "text-secondary",
        )}
      >
        {eyebrow}
      </p>
      <div
        className={cn("mt-3 h-px w-12 bg-accent", align === "center" && "mx-auto")}
        aria-hidden="true"
      />
      <h2
        id={id}
        className={cn(
          "mt-4 font-heading text-3xl leading-tight font-semibold sm:text-4xl",
          light ? "text-white" : "text-primary",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-7",
            light ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
