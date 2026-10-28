import { formatIsoDate } from "@/lib/dates";
import type {
  CommitteeReport,
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
  needsSupervisor: boolean;
  submittedAt: string;
  supervisor: Decision;
  dean: Decision;
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

export function summarise(chain: Chain): ApprovalSummary {
  const { supervisor, dean } = chain;
  const steps: TrailStep[] = chain.officeEntry
    ? [
        {
          label: "Recorded by the research office",
          by: dean.by,
          at: dean.at,
          state: "done",
        },
      ]
    : [
        { label: "Submitted", by: "", at: chain.submittedAt, state: "done" },
        ...(chain.needsSupervisor
          ? [
              {
                label:
                  supervisor.status === "returned"
                    ? "Rejected by Supervisor"
                    : "Approved by Supervisor",
                by: supervisor.by,
                at: supervisor.at,
                state:
                  supervisor.status === "approved"
                    ? ("done" as const)
                    : supervisor.status === "returned"
                      ? ("returned" as const)
                      : ("pending" as const),
                note: supervisor.status === "returned" ? supervisor.remarks : undefined,
              },
            ]
          : []),
        {
          label: dean.status === "returned" ? "Rejected by Dean" : "Approved by Dean",
          by: dean.by,
          at: dean.at,
          state:
            dean.status === "approved"
              ? "done"
              : dean.status === "returned"
                ? "returned"
                : "pending",
          note: dean.status === "returned" ? dean.remarks : undefined,
        },
      ];
  if (chain.officeEntry || dean.status === "approved") {
    return {
      label: chain.officeEntry ? "Recorded by the office" : "Approved by Dean",
      tone: "gold",
      detail: "",
      steps,
    };
  }
  if (dean.status === "returned") {
    return {
      label: "Rejected by Dean",
      tone: "maroon",
      detail: dean.remarks ?? "",
      steps,
    };
  }
  if (supervisor.status === "returned") {
    return {
      label: "Rejected by Supervisor",
      tone: "maroon",
      detail: supervisor.remarks ?? "",
      steps,
    };
  }
  if (supervisor.status === "approved") {
    return {
      label: "Approved by Supervisor",
      tone: "purple",
      detail: "Submitted to Dean",
      steps,
    };
  }
  return {
    label: chain.needsSupervisor ? "Submitted to Supervisor" : "Submitted to Dean",
    tone: "outline",
    detail: "",
    steps,
  };
}

export function committeeSummary(report: CommitteeReport) {
  return summarise({
    needsSupervisor: !report.officeEntry,
    officeEntry: report.officeEntry,
    submittedAt: report.createdAt,
    supervisor: {
      status:
        report.supervisorStatus === "Recommended"
          ? "approved"
          : report.supervisorStatus === "Returned"
            ? "returned"
            : "",
      by: report.supervisorName,
      at: report.supervisorAt || report.supervisorOn,
      remarks: report.supervisorRemarks,
    },
    dean: {
      status:
        report.status === "Approved"
          ? "approved"
          : report.status === "Rejected" && report.supervisorStatus !== "Returned"
            ? "returned"
            : "",
      by: report.decidedBy,
      at: report.decidedAt || report.decidedOn,
      remarks: report.remarks,
    },
  });
}

export function submissionSummary(item: SynopsisSubmission | ThesisSubmission) {
  return summarise({
    needsSupervisor: item.needsSupervisor,
    submittedAt: item.createdAt,
    supervisor: {
      status:
        item.supervisorStatus === "Recommended"
          ? "approved"
          : item.supervisorStatus === "Returned"
            ? "returned"
            : "",
      by: item.supervisorName,
      at: item.supervisorAt || item.supervisorOn,
      remarks: item.supervisorRemarks,
    },
    dean: {
      status:
        item.status === "Approved"
          ? "approved"
          : item.status === "Rejected" && item.supervisorStatus !== "Returned"
            ? "returned"
            : "",
      by: item.decidedBy,
      at: item.decidedAt || item.decidedOn,
      remarks: item.remarks,
    },
  });
}

export function recordSummary(record: ScholarRecord, needsSupervisor: boolean) {
  const payload = record.payload;
  const returnedBySupervisor =
    payload.returnedByRole === "supervisor" ||
    (!payload.returnedByRole && needsSupervisor && !payload.supervisorOn);
  return summarise({
    needsSupervisor,
    submittedAt: record.createdAt,
    supervisor: {
      status:
        record.status === "Returned" && returnedBySupervisor
          ? "returned"
          : payload.supervisorOn
            ? "approved"
            : "",
      by:
        record.status === "Returned" && returnedBySupervisor
          ? (payload.returnedBy ?? record.supervisorName)
          : (payload.supervisorBy ?? record.supervisorName),
      at:
        record.status === "Returned" && returnedBySupervisor
          ? (payload.returnedAt ?? payload.returnedOn ?? "")
          : (payload.supervisorAt ?? payload.supervisorOn ?? ""),
      remarks: payload.remarks,
    },
    dean: {
      status:
        record.status === "Approved"
          ? "approved"
          : record.status === "Returned" && !returnedBySupervisor
            ? "returned"
            : "",
      by:
        record.status === "Returned" && !returnedBySupervisor
          ? (payload.returnedBy ?? "")
          : (payload.approvedBy ?? ""),
      at:
        record.status === "Returned" && !returnedBySupervisor
          ? (payload.returnedAt ?? payload.returnedOn ?? "")
          : (payload.approvedAt ?? payload.approvedOn ?? ""),
      remarks: payload.remarks,
    },
  });
}
