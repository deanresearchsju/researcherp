import { menuByKind, type ScholarRecordKind } from "@/data/scholar-records";

type Side = "scholar" | "admin" | "supervisor";

/** Page a notice about a scholar record opens. */
export function recordHref(side: Side, kind: ScholarRecordKind) {
  if (side === "supervisor") return "/supervisor/reviews";
  if (kind === "six_month_report") return `/${side}/reports`;
  if (kind === "payment") return side === "admin" ? "/admin/payments" : "/scholar/fee";
  if (kind === "personal_details") {
    return side === "admin" ? "/admin/register?tab=entry" : "/scholar/dashboard";
  }
  return `/${side}/records/${menuByKind(kind).slug}`;
}

/** Page for a doctoral committee report. */
export function committeeHref(side: Side, kind: "first" | "second" | "third" | "fourth") {
  if (side === "supervisor") return "/supervisor/committees";
  const page =
    kind === "first" ? "dc-first" : kind === "second" ? "confirmation" : "dc-third";
  return `/${side}/${page}`;
}

export function recordLabel(kind: ScholarRecordKind) {
  return menuByKind(kind).label;
}
