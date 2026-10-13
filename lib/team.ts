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

export const teamContactMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261013210000_research_team_contact.sql.";

export const teamSelect = "id, sort_order, role, name, email, phone, photo";

export function officeTeam(): TeamMember[] {
  return teamSeed.map((member) => ({ ...member, id: `office-${member.sortOrder}` }));
}

type TeamRow = {
  id: string;
  sort_order: number;
  role: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  photo?: string | null;
};

export function mapTeamMember(row: TeamRow): TeamMember {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    role: row.role,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    photo: row.photo ?? "",
  };
}

function missingContactColumn(message: string) {
  return /email|phone|photo|column|schema cache/i.test(message);
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

  const full = await supabase
    .from("research_team")
    .select(teamSelect)
    .order("sort_order", { ascending: true });

  const fallback =
    full.error && missingContactColumn(full.error.message)
      ? await supabase
          .from("research_team")
          .select("id, sort_order, role, name")
          .order("sort_order", { ascending: true })
      : null;

  const data = fallback ? fallback.data : full.data;
  const error = fallback ? fallback.error : full.error;

  if (error || !data) {
    return {
      members: officeTeam(),
      source: "office-copy",
      detail: "The team table is not in the database yet.",
    };
  }

  if (fallback && !fallback.error) {
    return {
      members: data.map(mapTeamMember),
      source: data.length === 0 ? "empty" : "database",
      detail: teamContactMigrationHint,
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
