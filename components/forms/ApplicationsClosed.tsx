export function ApplicationsClosed({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-card">
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Center for Research
      </p>
      <h2 className="mt-2 font-heading text-3xl text-primary">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p>
    </section>
  );
}
