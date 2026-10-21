import {
  latestCommittee,
  latestSynopsis,
  synopsisSubmitted,
  type DoctoralState,
} from "@/lib/doctoral";
import { sameId } from "@/lib/office";
import { scholarBySignIn } from "@/lib/register";
import type { ScholarRecord } from "@/lib/scholar-records";

export type TitleStage = "Not fixed" | "Proposed" | "Provisional" | "Final" | "Locked";

export type ResearchTitle = {
  title: string;
  stage: TitleStage;
  /** Short line shown under the title. */
  note: string;
  /** Why a title-change request cannot be sent now; null when it can. */
  changeBlock: string | null;
};

export const titleRuleText =
  "The research title is fixed in the first doctoral committee and finalised in the second (Ph.D. confirmation). After the synopsis is submitted the title cannot be changed.";

/**
 * The scholar's research title: fixed at the first committee, finalised at the second, changed
 * only by an approved title-change request between the second committee and the synopsis, and
 * locked once the synopsis is submitted.
 */
export function researchTitleOf(
  state: Pick<DoctoralState, "committees" | "synopses">,
  identifier: string,
  titleChanges: readonly ScholarRecord[] = [],
): ResearchTitle {
  const first = latestCommittee(state, "first", identifier);
  const second = latestCommittee(state, "second", identifier);
  const firstApproved = first?.status === "Approved";
  const secondApproved = second?.status === "Approved";
  const locked = synopsisSubmitted(state, identifier);

  // Scholars admitted before the ERP: the register holds the title their committees fixed.
  const registered = scholarBySignIn(identifier);
  const registerTitle = registered?.title.trim() ?? "";
  if (!first && !second && registerTitle && !locked) {
    const finalised = Boolean(registered?.secondDc.trim());
    return {
      title: registerTitle,
      stage: finalised ? "Final" : "Provisional",
      note: finalised ? "As in the scholar register" : "As in the scholar register · finalised at the second committee",
      changeBlock: finalised
        ? null
        : "The title is finalised at the second doctoral committee. Propose the final title in that report.",
    };
  }

  let title = "";
  if (!first && !second) title = registerTitle;
  if (firstApproved && first.researchTitle) title = first.researchTitle;
  if (secondApproved && second.researchTitle) title = second.researchTitle;
  if (secondApproved) {
    const since = second.decidedOn || second.createdAt.slice(0, 10);
    const synopsisOn = latestSynopsis(state, identifier)?.createdAt ?? "";
    const change = titleChanges
      .filter(
        (record) =>
          record.status === "Approved" &&
          sameId(record.scholarIdentifier, identifier) &&
          record.createdAt.slice(0, 10) >= since &&
          (!locked || !synopsisOn || record.createdAt < synopsisOn) &&
          record.payload.proposedTitle?.trim(),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (change) title = change.payload.proposedTitle.trim();
  }

  if (locked) {
    return {
      title,
      stage: "Locked",
      note: "Locked · the synopsis is submitted",
      changeBlock: "The synopsis is submitted, so the research title cannot be changed.",
    };
  }
  if (secondApproved) {
    return {
      title,
      stage: "Final",
      note: "Finalised in the second doctoral committee",
      changeBlock: null,
    };
  }
  const pendingTitle = second?.status === "Submitted" ? second.researchTitle : "";
  if (firstApproved) {
    return {
      title,
      stage: "Provisional",
      note: pendingTitle
        ? `Fixed in the first committee · final title awaiting approval: ${pendingTitle}`
        : "Fixed in the first doctoral committee · finalised at the second",
      changeBlock:
        "The title is finalised at the second doctoral committee. Propose the final title in that report.",
    };
  }
  const proposed = first?.status === "Submitted" ? first.researchTitle : "";
  return {
    title: proposed,
    stage: proposed ? "Proposed" : "Not fixed",
    note: proposed
      ? "Proposed in the first committee report · awaiting approval"
      : "Fixed in the first doctoral committee",
    changeBlock:
      "The title is fixed in the first doctoral committee and finalised in the second.",
  };
}
