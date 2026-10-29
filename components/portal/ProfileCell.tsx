import type { ScholarProfile } from "@/lib/use-scholar-profile";

/** A scholar's department, campus, guide and mode in two lines, for a table cell. */
export function ProfileCell({ profile }: { profile: ScholarProfile }) {
  const first = [profile.department, profile.campus].filter(Boolean).join(" · ");
  const second = [profile.guide, profile.mode].filter(Boolean).join(" · ");
  if (!first && !second) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <p>{first || "—"}</p>
      <p className="text-muted-foreground">{second || "—"}</p>
    </>
  );
}

export const profileColumnHeading = "Department · guide";
