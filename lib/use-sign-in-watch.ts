"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { clearPreviewSession, loginHref } from "@/lib/auth";
import { usePreviewSession } from "@/lib/use-preview-session";

const checkEvery = 60_000;
/** A signed-in person who has done nothing for this long is signed out. */
export const idleLimitMinutes = 30;

export const signOutReasons: Record<string, string> = {
  replaced:
    "You were signed out because this account signed in on another device or browser.",
  expired: "Your session ended. Please sign in again.",
  idle: `You were signed out after ${idleLimitMinutes} minutes without activity.`,
};

/**
 * Keeps the sign-in honest: signs out when the same user has signed in somewhere else (one
 * sign-in at a time), when the cookie has ended, and after a period without any activity.
 */
export function useSignInWatch() {
  const session = usePreviewSession();
  const router = useRouter();
  const role = session?.role ?? null;

  useEffect(() => {
    if (!role) return;
    let active = true;
    let lastActive = Date.now();

    const leave = (reason: string) => {
      if (!active) return;
      active = false;
      clearPreviewSession();
      router.replace(`${loginHref(role)}?reason=${reason}`);
    };

    const check = async () => {
      if (Date.now() - lastActive > idleLimitMinutes * 60_000) return leave("idle");
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (response.status === 401) {
          const body = (await response.json().catch(() => null)) as {
            reason?: string;
          } | null;
          leave(body?.reason === "replaced" ? "replaced" : "expired");
        }
      } catch {
        // No connection: try again at the next check.
      }
    };

    const touch = () => {
      lastActive = Date.now();
    };
    const visible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => void check(), checkEvery);
    void check();
    return () => {
      active = false;
      window.clearInterval(timer);
      events.forEach((name) => window.removeEventListener(name, touch));
      document.removeEventListener("visibilitychange", visible);
    };
  }, [role, router]);
}
