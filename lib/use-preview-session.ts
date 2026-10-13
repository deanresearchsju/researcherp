"use client";

import { useSyncExternalStore } from "react";

import { type PreviewSession } from "@/lib/auth";
import { sessionEventName, sessionStorageKey } from "@/lib/constants";

function readRaw() {
  return (
    window.localStorage.getItem(sessionStorageKey) ??
    window.sessionStorage.getItem(sessionStorageKey)
  );
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(sessionEventName, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(sessionEventName, onStoreChange);
  };
}

export function usePreviewSession(): PreviewSession | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PreviewSession;
    if (!parsed.identifier || !parsed.role) return null;
    return { ...parsed, name: parsed.name ?? "" };
  } catch {
    return null;
  }
}
