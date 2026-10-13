export function Portrait({
  src,
  name,
}: {
  src: string | null;
  name: string;
}) {
  return (
    <figure className="w-28 shrink-0">
      <div className="aspect-[7/9] overflow-hidden rounded-xl border border-border bg-muted">
        {src ? (
          // Photograph stored with the application; next/image cannot serve a data URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-contain" />
        ) : (
          <span className="grid h-full place-items-center px-2 text-center text-xs text-muted-foreground">
            No photograph
          </span>
        )}
      </div>
      <figcaption className="mt-1 text-center text-xs text-muted-foreground">{name}</figcaption>
    </figure>
  );
}
