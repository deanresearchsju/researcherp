"use client";

import { useSyncExternalStore } from "react";

import { UserManager } from "@/components/portal/UserManager";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";

export function UserScreen() {
  const load = useSyncExternalStore(subscribePortalUsers, currentPortalUsers, () => null);

  if (!load) {
    return <p className="text-sm text-muted-foreground">Loading users…</p>;
  }

  return <UserManager initial={load} />;
}
