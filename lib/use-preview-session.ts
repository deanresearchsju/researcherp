"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { type PreviewSession } from "@/lib/auth";
import { sessionEventName, sessionStorageKey } from "@/lib/constants";
import { currentOfficeView, subscribeOfficeView } from "@/lib/office-view";

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
    return {
      ...parsed,
      name: parsed.name ?? "",
      mustReset: parsed.mustReset === true,
      menus: parsed.menus,
    };
  } catch {
    return null;
  }
}

export function useOfficeView() {
  return useSyncExternalStore(subscribeOfficeView, currentOfficeView, () => null);
}

export function usePortalSession(): PreviewSession | null {
  const pathname = usePathname();
  const session = usePreviewSession();
  const view = useOfficeView();
  if (!view || session?.role !== "admin") return session;
  if (view.role === "scholar" && pathname.startsWith("/scholar")) {
    return {
      role: "scholar",
      identifier: view.identifier,
      name: view.name,
      mustReset: false,
      menus: null,
    };
  }
  if (view.role === "supervisor" && pathname.startsWith("/supervisor")) {
    return {
      role: "supervisor",
      identifier: view.identifier,
      name: view.name,
      mustReset: false,
      menus: null,
    };
  }
  return session;
}
