import { formatIsoDate } from "@/lib/dates";
import { stageNames, type ApprovalStage } from "@/lib/approval-rules";
import type {
  CommitteeReport,
  StepMark,
  SynopsisSubmission,
  ThesisSubmission,
} from "@/lib/doctoral";
import type { ScholarRecord } from "@/lib/scholar-records";

/**
 * What a scholar sees about a document that goes to the supervisor and then to the Dean: one
 * clear status ("Submitted to Supervisor", "Approved by Supervisor", "Approved by Dean"…) and
 * the trail behind it, each step with who acted and the exact date and time.
 */
export type ApprovalTone = "outline" | "purple" | "gold" | "maroon";

export type TrailStep = {
  label: string;
  by: string;
  /** Date or date-and-time as recorded. */
  at: string;
  state: "done" | "pending" | "returned";
  note?: string;
};

export type ApprovalSummary = {
  label: string;
  tone: ApprovalTone;
  /** A short second line, such as who the document waits for. */
  detail: string;
  steps: TrailStep[];
};

type Decision = {
  status: "" | "approved" | "returned";
  by: string;
  at: string;
  remarks?: string;
};

type Chain = {
  /** The steps the request goes through, in order; the last one gives the final approval. */
  stages: ApprovalStage[];
  submittedAt: string;
  decisions: Partial<Record<ApprovalStage, Decision>>;
  /** Recorded by the office without a submission. */
  officeEntry?: boolean;
};

/** "24 Oct 2026, 10:32 AM" for a recorded moment; the date alone when no time was kept. */
export function formatMoment(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (!text.includes("T")) return formatIsoDate(text.slice(0, 10));
  const moment = new Date(text);
  if (Number.isNaN(moment.getTime())) return formatIsoDate(text.slice(0, 10));
  const date = moment.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = moment
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toUpperCase();
  return `${date}, ${time}`;
}

/** The older shape of a request's steps: the supervisor's (when needed) and the Dean's. */
type LegacyChain = {
  needsSupervisor: boolean;
  submittedAt: string;
  supervisor: Decision;
  dean: Decision;
  officeEntry?: boolean;
};

function stepsOf(chain: Chain | LegacyChain): Chain {
  if ("stages" in chain) return chain;
  return {
    stages: chain.needsSupervisor ? ["supervisor", "dean"] : ["dean"],
    submittedAt: chain.submittedAt,
    decisions: { supervisor: chain.supervisor, dean: chain.dean },
    officeEntry: chain.officeEntry,
  };
}

export function summarise(given: Chain | LegacyChain): ApprovalSummary {
  const chain = stepsOf(given);
  const stages = chain.stages;
  const decisionOf = (stage: ApprovalStage): Decision =>
    chain.decisions[stage] ?? { status: "", by: "", at: "" };
  const last = stages.at(-1);
  const lastDecision = last ? decisionOf(last) : null;
  const steps: TrailStep[] = chain.officeEntry
    ? [
        {
          label: "Recorded by the research office",
          by: lastDecision?.by ?? "",
          at: lastDecision?.at ?? "",
          state: "done",
        },
      ]
    : [
        { label: "Submitted", by: "", at: chain.submittedAt, state: "done" },
        ...stages.map((stage): TrailStep => {
          const decision = decisionOf(stage);
          return {
            label:
              decision.status === "returned"
                ? `Rejected by ${stageNames[stage]}`
                : `Approved by ${stageNames[stage]}`,
            by: decision.by,
            at: decision.at,
            state:
              decision.status === "approved"
                ? "done"
                : decision.status === "returned"
                  ? "returned"
                  : "pending",
            note: decision.status === "returned" ? decision.remarks : undefined,
          };
        }),
      ];
  if (chain.officeEntry || (last && lastDecision?.status === "approved")) {
    return {
      label: chain.officeEntry
        ? "Recorded by the office"
        : `Approved by ${stageNames[last as ApprovalStage]}`,
      tone: "gold",
      detail: "",
      steps,
    };
  }
  const rejected = stages.find((stage) => decisionOf(stage).status === "returned");
  if (rejected) {
    return {
      label: `Rejected by ${stageNames[rejected]}`,
      tone: "maroon",
      detail: decisionOf(rejected).remarks ?? "",
      steps,
    };
  }
  const pending = stages.find((stage) => decisionOf(stage).status !== "approved");
  const passed = stages.filter((stage) => decisionOf(stage).status === "approved");
  if (passed.length > 0) {
    return {
      label: `Approved by ${stageNames[passed[passed.length - 1]]}`,
      tone: "purple",
      detail: pending ? `Submitted to ${stageNames[pending]}` : "",
      steps,
    };
  }
  return {
    label: `Submitted to ${stageNames[pending ?? "dean"]}`,
    tone: "outline",
    detail: "",
    steps,
  };
}

/** The decisions of a document that carries its steps (committee reports, synopsis, thesis). */
function submissionDecisions(item: {
  status: "Submitted" | "Approved" | "Rejected";
  chain: readonly ApprovalStage[];
  steps: readonly StepMark[];
  supervisorStatus: "" | "Recommended" | "Returned";
  supervisorName: string;
  supervisorAt: string;
  supervisorOn: string;
  supervisorRemarks: string;
  decidedBy: string;
  decidedAt: string;
  decidedOn: string;
  remarks: string;
}) {
  const chain: ApprovalStage[] = item.chain.length > 0 ? [...item.chain] : ["dean"];
  const last = chain[chain.length - 1];
  const decisions: Partial<Record<ApprovalStage, Decision>> = {};
  for (const stage of chain) {
    if (stage === "supervisor") {
      decisions.supervisor = {
        status:
          item.supervisorStatus === "Recommended"
            ? "approved"
            : item.supervisorStatus === "Returned"
              ? "returned"
              : "",
        by: item.supervisorName,
        at: item.supervisorAt || item.supervisorOn,
        remarks: item.supervisorRemarks,
      };
      continue;
    }
    const step = item.steps.find((entry) => entry.stage === stage);
    if (step) {
      decisions[stage] = {
        status: step.status === "Returned" ? "returned" : "approved",
        by: step.by,
        at: step.at,
        remarks: step.remarks,
      };
    } else if (stage === last && item.status === "Approved") {
      decisions[stage] = {
        status: "approved",
        by: item.decidedBy,
        at: item.decidedAt || item.decidedOn,
      };
    } else if (
      stage === last &&
      item.status === "Rejected" &&
      item.supervisorStatus !== "Returned"
    ) {
      // A rejection saved before the steps were kept: it was the last step's.
      decisions[stage] = {
        status: "returned",
        by: item.decidedBy,
        at: item.decidedAt || item.decidedOn,
        remarks: item.remarks,
      };
    } else if (item.status === "Approved") {
      decisions[stage] = { status: "approved", by: "", at: "" };
    }
  }
  return { chain, decisions };
}

export function committeeSummary(report: CommitteeReport) {
  if (report.officeEntry) {
    return summarise({
      stages: ["dean"],
      officeEntry: true,
      submittedAt: report.createdAt,
      decisions: {
        dean: {
          status: "approved",
          by: report.decidedBy,
          at: report.decidedAt || report.decidedOn,
        },
      },
    });
  }
  const { chain, decisions } = submissionDecisions(report);
  return summarise({ stages: chain, submittedAt: report.createdAt, decisions });
}

export function submissionSummary(item: SynopsisSubmission | ThesisSubmission) {
  const { chain, decisions } = submissionDecisions(item);
  return summarise({ stages: chain, submittedAt: item.createdAt, decisions });
}

/** The steps of a scholar request: the ones stored with it, or the supervisor's and the Dean's. */
export function recordStages(
  record: ScholarRecord,
  needsSupervisor: boolean,
): ApprovalStage[] {
  const stored = String(record.payload.chain ?? "")
    .split(",")
    .filter(
      (item): item is ApprovalStage =>
        item === "supervisor" || item === "dean" || item === "vc",
    );
  if (stored.length > 0) return stored;
  return needsSupervisor ? ["supervisor", "dean"] : ["dean"];
}

export function recordSummary(record: ScholarRecord, needsSupervisor: boolean) {
  const payload = record.payload;
  const stages = recordStages(record, needsSupervisor);
  const last = stages[stages.length - 1];
  const returnedByRole = payload.returnedByRole ?? "";
  // Who turned it down: the role stored with it, or (for older records) the supervisor while
  // the supervisor had not approved, otherwise the last step.
  const supervisorPending = stages.includes("supervisor") && !payload.supervisorOn;
  const returnedBy: ApprovalStage | null =
    record.status !== "Returned"
      ? null
      : returnedByRole === "supervisor" ||
          returnedByRole === "dean" ||
          returnedByRole === "vc"
        ? returnedByRole
        : supervisorPending
          ? "supervisor"
          : last;
  const decisions: Partial<Record<ApprovalStage, Decision>> = {};
  for (const stage of stages) {
    if (returnedBy === stage) {
      decisions[stage] = {
        status: "returned",
        by: payload.returnedBy ?? (stage === "supervisor" ? record.supervisorName : ""),
        at: payload.returnedAt ?? payload.returnedOn ?? "",
        remarks: payload.remarks,
      };
    } else if (stage === last && record.status === "Approved") {
      decisions[stage] = {
        status: "approved",
        by: payload.approvedBy ?? "",
        at: payload.approvedAt ?? payload.approvedOn ?? "",
        remarks: payload.remarks,
      };
    } else if (payload[`${stage}On`]) {
      decisions[stage] = {
        status: "approved",
        by:
          payload[`${stage}By`] ?? (stage === "supervisor" ? record.supervisorName : ""),
        at: payload[`${stage}At`] ?? payload[`${stage}On`] ?? "",
        remarks: payload.remarks,
      };
    }
  }
  return summarise({ stages, submittedAt: record.createdAt, decisions });
}
