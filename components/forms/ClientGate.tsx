"use client";

import { useSyncExternalStore, type ReactNode } from "react";

export function ClientGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!ready) {
    return (
      fallback ?? (
        <div className="mx-auto h-80 w-full max-w-6xl animate-pulse rounded-xl bg-muted" />
      )
    );
  }
  return children;
}
