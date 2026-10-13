import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <header className="border-b border-border bg-white">
      <div className={cn("mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8")}>
        <p className="text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
          {eyebrow}
        </p>
        <div className="mt-3 h-px w-12 bg-accent" aria-hidden="true" />
        <h1 className="mt-4 font-heading text-4xl text-primary">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}
