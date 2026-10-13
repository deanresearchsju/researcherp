import type { Metadata } from "next";
import { Suspense } from "react";

import { TeamManager } from "@/components/portal/TeamManager";
import { loadTeam } from "@/lib/team";

export const metadata: Metadata = {
  title: "Our Team",
  robots: { index: false, follow: false },
};

async function TeamEditor() {
  const initial = await loadTeam();
  return <TeamManager initial={initial} />;
}

export default function AdminTeamPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the team…</p>}>
      <TeamEditor />
    </Suspense>
  );
}
