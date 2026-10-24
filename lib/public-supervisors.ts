import { cacheLife, cacheTag } from "next/cache";

import { parseProfiles, vidwanLink } from "@/lib/register";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createSupabase } from "@/lib/supabase/client";

/** A supervisor profile as the public website shows it. The sign-in id is never included. */
export type PublicSupervisor = {
  slug: string;
  name: string;
  designation: string;
  department: string;
  researchArea: string;
  bio: string;
  vidwanUrl: string;
  vidwanId: string;
  hasPhoto: boolean;
  updatedOn: string;
};

type Entry = PublicSupervisor & { key: string };

function slugOf(name: string) {
  return name
    .replace(/^dr\.?\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function client() {
  return createAdminSupabase() ?? createSupabase();
}

/**
 * The published supervisor profiles, kept for a few minutes so the page is served as plain HTML
 * to search engines and visitors alike. A change made by the research office shows within minutes.
 */
async function loadEntries(): Promise<Entry[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("supervisors");
  const supabase = client();
  if (!supabase) return [];
  const { data } = await supabase
    .from("research_register")
    .select("payload")
    .eq("id", "register")
    .maybeSingle();
  const payload = data?.payload as { profiles?: unknown } | null;
  const published = parseProfiles(payload?.profiles)
    .filter((item) => item.published && item.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name));
  if (published.length === 0) return [];
  const { data: photos } = await supabase
    .from("profile_photos")
    .select("id")
    .in(
      "id",
      published.map((item) => `supervisor:${item.key}`),
    );
  const withPhoto = new Set((photos ?? []).map((row) => row.id));
  const used = new Set<string>();
  return published.map((item) => {
    const base = slugOf(item.name) || "supervisor";
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    return {
      key: item.key,
      slug,
      name: item.name.trim(),
      designation: item.designation.trim(),
      department: item.department.trim(),
      researchArea: item.researchArea.trim(),
      bio: item.bio.trim(),
      vidwanUrl: vidwanLink(item.vidwan),
      vidwanId: /^https?:\/\//i.test(item.vidwan.trim()) ? "" : item.vidwan.trim(),
      hasPhoto: withPhoto.has(`supervisor:${item.key}`),
      updatedOn: item.updatedOn,
    };
  });
}

export async function publicSupervisors(): Promise<PublicSupervisor[]> {
  const entries = await loadEntries();
  return entries.map((entry) => ({
    slug: entry.slug,
    name: entry.name,
    designation: entry.designation,
    department: entry.department,
    researchArea: entry.researchArea,
    bio: entry.bio,
    vidwanUrl: entry.vidwanUrl,
    vidwanId: entry.vidwanId,
    hasPhoto: entry.hasPhoto,
    updatedOn: entry.updatedOn,
  }));
}

export async function publicSupervisor(slug: string) {
  return (await publicSupervisors()).find((item) => item.slug === slug) ?? null;
}

/** The photograph of a published supervisor as image bytes, or null. */
export async function supervisorPhoto(slug: string) {
  const entry = (await loadEntries()).find((item) => item.slug === slug);
  if (!entry?.hasPhoto) return null;
  const supabase = client();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profile_photos")
    .select("photo")
    .eq("id", `supervisor:${entry.key}`)
    .maybeSingle();
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(data?.photo ?? "");
  if (!match) return null;
  return { type: match[1], bytes: Buffer.from(match[2], "base64") };
}
