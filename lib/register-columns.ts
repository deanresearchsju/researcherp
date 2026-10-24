import type { ResearchScholar } from "@/data/research-register";
import { batchById } from "@/lib/batches";
import type { DoctoralState } from "@/lib/doctoral";
import { guideCampus } from "@/lib/registration-format";
import {
  registrationOf,
  supervisorForGuide,
  type RegistrationAllotment,
} from "@/lib/register";
import { liveMilestones } from "@/lib/scholar-report";

/**
 * The information the Scholar register holds about a scholar. Each item is listed in the
 * table or the detail view, can be chosen for an export, and (where it has a short list of
 * values) can be used as a filter, so what can be exported can also be filtered.
 */
export type RegisterContext = {
  scholar: ResearchScholar;
  registration: string;
  batch: string;
  campus: string;
  area: string;
  milestones: ReturnType<typeof liveMilestones>;
};

export type RegisterGroup = "Identity" | "Programme" | "Contact" | "Research" | "Progress";

export type RegisterColumn = {
  id: string;
  label: string;
  group: RegisterGroup;
  value: (context: RegisterContext) => string;
  /** The values offered as a filter; absent for free text, which the search box covers. */
  filterValue?: (context: RegisterContext) => string;
};

const text = (value: string | undefined | null) => (value ?? "").trim();

/** A milestone is "Done" once the register or the ERP records it. */
const doneOrNot = (value: string) => (value.trim() ? "Done" : "Not yet");

function milestone(
  pick: (context: RegisterContext) => string,
): Pick<RegisterColumn, "value" | "filterValue"> {
  return { value: pick, filterValue: (context) => doneOrNot(pick(context)) };
}

export function stageOf(context: RegisterContext) {
  const steps: [string, string][] = [
    ["Viva", context.milestones?.viva ?? context.scholar.viva],
    ["Thesis", context.milestones?.thesis ?? context.scholar.thesis],
    ["Synopsis", context.milestones?.synopsis ?? context.scholar.synopsis],
    ["Confirmed", context.milestones?.confirmation ?? context.scholar.confirmation],
    ["Second DC", context.milestones?.secondDc ?? context.scholar.secondDc],
    ["First DC", context.milestones?.firstDc ?? context.scholar.firstDc],
  ];
  const reached = steps.find(([, value]) => value.trim());
  return reached ? `${reached[0]} done` : "Admitted";
}

export const registerColumns: readonly RegisterColumn[] = [
  {
    id: "registration",
    label: "Registration number",
    group: "Identity",
    value: (c) => c.registration,
  },
  {
    id: "application",
    label: "Application number",
    group: "Identity",
    value: (c) => text(c.scholar.applicationNumber),
  },
  {
    id: "file",
    label: "File number",
    group: "Identity",
    value: (c) => text(c.scholar.fileNumber),
  },
  { id: "name", label: "Name", group: "Identity", value: (c) => text(c.scholar.name) },
  {
    id: "batch",
    label: "Batch",
    group: "Identity",
    value: (c) => c.batch,
    filterValue: (c) => c.batch,
  },
  {
    id: "mode",
    label: "Mode of study",
    group: "Identity",
    value: (c) => text(c.scholar.category),
    filterValue: (c) => text(c.scholar.category),
  },
  {
    id: "department",
    label: "Department",
    group: "Programme",
    value: (c) => text(c.scholar.department),
    filterValue: (c) => text(c.scholar.department),
  },
  {
    id: "guide",
    label: "Guide",
    group: "Programme",
    value: (c) => text(c.scholar.guideName),
    filterValue: (c) => text(c.scholar.guideName),
  },
  {
    id: "campus",
    label: "Guide campus",
    group: "Programme",
    value: (c) => c.campus,
    filterValue: (c) => c.campus,
  },
  {
    id: "area",
    label: "Area of research",
    group: "Programme",
    value: (c) => c.area,
    filterValue: (c) => c.area,
  },
  { id: "phone", label: "Phone", group: "Contact", value: (c) => text(c.scholar.phone) },
  { id: "email", label: "Mail", group: "Contact", value: (c) => text(c.scholar.email) },
  {
    id: "institution",
    label: "Working institution",
    group: "Contact",
    value: (c) => text(c.scholar.institution),
    filterValue: (c) => text(c.scholar.institution),
  },
  {
    id: "title",
    label: "Title of research",
    group: "Research",
    value: (c) => text(c.scholar.title),
  },
  {
    id: "stage",
    label: "Stage",
    group: "Progress",
    value: stageOf,
    filterValue: stageOf,
  },
  {
    id: "firstDc",
    label: "1st DC",
    group: "Progress",
    ...milestone((c) => c.milestones?.firstDc ?? c.scholar.firstDc),
  },
  {
    id: "secondDc",
    label: "2nd DC",
    group: "Progress",
    ...milestone((c) => c.milestones?.secondDc ?? c.scholar.secondDc),
  },
  {
    id: "confirmation",
    label: "Confirmation",
    group: "Progress",
    ...milestone((c) => c.milestones?.confirmation ?? c.scholar.confirmation),
  },
  {
    id: "colloquium1",
    label: "Colloquium 1",
    group: "Progress",
    ...milestone((c) => c.milestones?.colloquium1 ?? c.scholar.colloquium1),
  },
  {
    id: "colloquium2",
    label: "Colloquium 2",
    group: "Progress",
    ...milestone((c) => c.milestones?.colloquium2 ?? c.scholar.colloquium2),
  },
  {
    id: "colloquium",
    label: "Colloquium attendance",
    group: "Progress",
    value: (c) => c.milestones?.colloquium ?? "",
  },
  {
    id: "synopsis",
    label: "Synopsis",
    group: "Progress",
    ...milestone((c) => c.milestones?.synopsis ?? c.scholar.synopsis),
  },
  {
    id: "thesis",
    label: "Thesis",
    group: "Progress",
    ...milestone((c) => c.milestones?.thesis ?? c.scholar.thesis),
  },
  {
    id: "viva",
    label: "Viva",
    group: "Progress",
    ...milestone((c) => c.milestones?.viva ?? c.scholar.viva),
  },
];

export const registerGroups: readonly RegisterGroup[] = [
  "Identity",
  "Programme",
  "Contact",
  "Research",
  "Progress",
];

/** What the list shows; the rest is in the scholar's detail view and the export. */
export const tableColumnIds = [
  "registration",
  "name",
  "department",
  "batch",
  "mode",
  "guide",
  "stage",
] as const;

export const exportPresets: { id: string; label: string; ids: readonly string[] }[] = [
  {
    id: "list",
    label: "Name list",
    ids: ["registration", "name", "department", "batch", "mode", "guide", "campus"],
  },
  {
    id: "contact",
    label: "Contact list",
    ids: ["registration", "name", "department", "batch", "phone", "email", "institution"],
  },
  {
    id: "progress",
    label: "Progress report",
    ids: [
      "registration",
      "name",
      "department",
      "batch",
      "guide",
      "title",
      "firstDc",
      "secondDc",
      "confirmation",
      "colloquium1",
      "colloquium2",
      "synopsis",
      "thesis",
      "viva",
    ],
  },
  { id: "all", label: "Everything", ids: registerColumns.map((column) => column.id) },
];

export const defaultExportIds = exportPresets[0].ids;

export function registerContext(
  scholar: ResearchScholar,
  allotments: readonly RegistrationAllotment[],
  doctoral: DoctoralState | null,
): RegisterContext {
  return {
    scholar,
    registration: text(registrationOf(scholar, allotments)),
    batch: batchById(scholar.batchId)?.name ?? "",
    campus: guideCampus(scholar.guideName),
    area: text(supervisorForGuide(scholar.guideName)?.researchArea),
    milestones: doctoral ? liveMilestones(scholar, doctoral) : null,
  };
}
