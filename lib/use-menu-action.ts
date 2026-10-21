"use client";

import { usePathname } from "next/navigation";

import { canMenuAction, matchMenuHref, type MenuActionKind } from "@/lib/access";
import { usePreviewSession } from "@/lib/use-preview-session";

export function useCanMenuAction(action: MenuActionKind, href?: string) {
  const pathname = usePathname();
  const session = usePreviewSession();
  const matched = href ?? (session ? matchMenuHref(pathname, session.role) : null);
  return canMenuAction(session, matched, action);
}
