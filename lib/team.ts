import { teamSeed, type TeamSeed } from "@/data/team";
import { createSupabase } from "@/lib/supabase/client";

export type TeamMember = TeamSeed & { id: string };

export type TeamSource = "database" | "empty" | "office-copy";

export type TeamLoad = {
  members: TeamMember[];
  source: TeamSource;
  detail: string | null;
};

export const teamMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013150000_research_team.sql.";

export function officeTeam(): TeamMember[] {
  return teamSeed.map((member) => ({ ...member, id: `office-${member.sortOrder}` }));
}

type TeamRow = {
  id: string;
  sort_order: number;
  role: string;
  name: string;
};

export function mapTeamMember(row: TeamRow): TeamMember {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    role: row.role,
    name: row.name,
  };
}

export async function loadTeam(): Promise<TeamLoad> {
  const supabase = createSupabase();
  if (!supabase) {
    return {
      members: officeTeam(),
      source: "office-copy",
      detail: "Supabase is not configured.",
    };
  }

  const { data, error } = await supabase
    .from("research_team")
    .select("id, sort_order, role, name")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return {
      members: officeTeam(),
      source: "office-copy",
      detail: "The team table is not in the database yet.",
    };
  }

  if (data.length === 0) {
    return { members: [], source: "empty", detail: null };
  }

  return {
    members: data.map(mapTeamMember),
    source: "database",
    detail: null,
  };
}
