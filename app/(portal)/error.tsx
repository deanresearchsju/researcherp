"use client";

import { Button } from "@/components/ui/button";

export default function PortalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-xl">
      <h1 className="font-heading text-3xl text-primary">This page could not be opened</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Try again. If it continues, write to the research office.
      </p>
      <Button type="button" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
