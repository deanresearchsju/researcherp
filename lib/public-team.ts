import { cacheLife, cacheTag } from "next/cache";

import { mapTeamMember, officeTeam, teamSelect, type TeamMember } from "@/lib/team";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createSupabase } from "@/lib/supabase/client";

function client() {
  return createAdminSupabase() ?? createSupabase();
}

const photoPath = (id: string, stamp: number) =>
  `/team/photo/${encodeURIComponent(id)}?v=${stamp}`;

/**
 * The team as the public Our Team page shows it. The page keeps it for a few minutes, so a
 * visit does not wait for the database, and each photograph is a small image address of its
 * own (cached by the browser) instead of a large block of text inside the page.
 */
export async function publicTeam(): Promise<TeamMember[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("team");
  const supabase = client();
  if (!supabase) return officeTeam();
  const { data, error } = await supabase
    .from("research_team")
    .select(teamSelect)
    .order("sort_order", { ascending: true });
  if (error || !data) return officeTeam();
  if (data.length === 0) return officeTeam();
  return data.map((row) => {
    const member = mapTeamMember(row);
    return {
      ...member,
      photo: member.photo.startsWith("data:")
        ? photoPath(member.id, member.photo.length)
        : member.photo,
    };
  });
}

/** One stored photograph as image bytes, for the /team/photo route. */
export async function teamPhoto(id: string) {
  const supabase = client();
  if (!supabase) return null;
  const { data } = await supabase
    .from("research_team")
    .select("photo")
    .eq("id", id)
    .maybeSingle();
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(data?.photo ?? "");
  if (!match) return null;
  return { type: match[1], bytes: Buffer.from(match[2], "base64") };
}
