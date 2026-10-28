/**
 * The greeting at the top of every dashboard: the person by name, their role, today's date and
 * a line about what the page is for.
 */
export function WelcomeBanner({
  name,
  roleLabel,
  summary,
}: {
  /** Empty until the signed-in name is known, so no wrong name flashes. */
  name?: string;
  roleLabel: string;
  summary?: string;
}) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <section className="rounded-2xl border border-border bg-card px-5 py-4 shadow-card sm:px-6">
      <p className="text-[0.68rem] font-bold tracking-[0.18em] text-secondary uppercase">
        {roleLabel}
      </p>
      <h1 className="mt-1 font-heading text-2xl text-primary sm:text-3xl">
        {name ? `Welcome, ${name}` : "Welcome"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground" suppressHydrationWarning>
        {today}
        {summary ? ` · ${summary}` : ""}
      </p>
    </section>
  );
}
