"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  DeskModal,
  DeskPage,
  DeskTable,
  DeskTabs,
  StatusPill,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { FeeStatus } from "@/data/payments";
import {
  currentAdmission,
  decideApplicationFees,
  isArchivedApplication,
  subscribeAdmission,
} from "@/lib/admission";
import { formatIsoDate } from "@/lib/dates";
import { rupees, useFees } from "@/lib/fee-settings";
import {
  currentDoctoral,
  setCourseWorkPayment,
  subscribeDoctoral,
  type CourseRegistration,
} from "@/lib/doctoral";
import { currentApplications, subscribeApplications } from "@/lib/records";
import {
  currentScholarRecords,
  loadRecordFile,
  setScholarRecordStatus,
  subscribeScholarRecords,
} from "@/lib/scholar-records";
import { isSubmissionFeePurpose } from "@/lib/submission-fees";
import { formatInr } from "@/lib/utils";
import type { Json } from "@/types/database";
import { fileAsDataUrl } from "@/lib/file-store";

export type FeeKind = "registration" | "course-work" | "annual" | "synopsis" | "thesis";

const kindCopy: Record<FeeKind, { title: string; detail: string }> = {
  registration: {
    title: "Registration fee",
    detail: "Ph.D. registration (application) fee paid with each application.",
  },
  "course-work": {
    title: "Course-work registration fee",
    detail: "Fee paid by scholars when they register for course work.",
  },
  annual: {
    title: "Annual fee",
    detail: "Annual research (tuition) fee receipts uploaded by scholars.",
  },
  synopsis: {
    title: "Synopsis fee",
    detail:
      "Fee paid by scholars to submit the synopsis. The amount is fixed by the administrator; the synopsis upload opens once the payment is verified.",
  },
  thesis: {
    title: "Thesis fee",
    detail:
      "Fee paid by scholars to submit the Ph.D. thesis. The amount is fixed by the administrator; the thesis upload opens once the payment is verified.",
  },
};

type FeeRow = {
  id: string;
  ids: string[];
  name: string;
  identifier: string;
  detail: string;
  amount: string;
  paidOn: string;
  mode: string;
  reference: string;
  status: FeeStatus;
  receiptName: string | null;
  receiptData: string | null;
  load?: () => Promise<string | null>;
};

function field(payload: Json, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function applicationReceipt(payload: Json) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const files = (payload as Record<string, unknown>).files;
  if (!files || typeof files !== "object") return null;
  const file = (files as Record<string, unknown>).feeReceipt;
  if (typeof file === "string") return { name: "Receipt", data: file };
  if (!file || typeof file !== "object") return null;
  const row = file as Record<string, unknown>;
  const data = typeof row.fileData === "string" ? row.fileData : "";
  const name = typeof row.fileName === "string" ? row.fileName : "Receipt";
  return data ? { name, data } : { name, data: "" };
}

function courseGroups(rows: readonly CourseRegistration[]): FeeRow[] {
  const map = new Map<string, CourseRegistration[]>();
  for (const row of rows) {
    const key = [
      row.scholarIdentifier.toLowerCase(),
      row.paymentDate,
      row.paymentReference,
      String(row.semester),
    ].join("|");
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.values()].map((papers) => {
    const first = papers[0];
    return {
      id: first.id,
      ids: papers.map((item) => item.id),
      name: first.scholarName,
      identifier: first.scholarIdentifier,
      detail: `Semester ${first.semester} · ${papers
        .map((item) => item.code || item.name)
        .filter(Boolean)
        .join(", ")}`,
      amount: formatInr(papers.reduce((sum, item) => sum + (item.amount || 0), 0)),
      paidOn: first.paymentDate,
      mode: first.paymentMode,
      reference: first.paymentReference,
      status: first.paymentStatus,
      receiptName: first.receiptName,
      receiptData: first.receiptData,
    };
  });
}

function yearOf(date: string) {
  return /^\d{4}/.test(date) ? date.slice(0, 4) : "";
}

export function AccountsFeeScreen({ kind }: { kind: FeeKind }) {
  const fees = useFees();
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const applications = useSyncExternalStore(
    subscribeApplications,
    currentApplications,
    () => null,
  );
  const annual = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<FeeRow | null>(null);

  const rows: FeeRow[] = (() => {
    if (kind === "registration") {
      return (applications ?? [])
        .filter(
          (row) =>
            row.kind === "phd" && !isArchivedApplication(row, admission?.archived ?? []),
        )
        .map((row) => {
          const found = admission?.cases.find(
            (item) =>
              item.applicationId === row.id || item.applicationNo === row.applicationNo,
          );
          const receipt = applicationReceipt(row.payload);
          return {
            id: row.id,
            ids: [row.id],
            name: row.applicantName,
            identifier: row.applicationNo,
            detail: [field(row.payload, "school"), field(row.payload, "specialization")]
              .filter(Boolean)
              .join(" · "),
            amount: rupees(fees.application),
            paidOn: field(row.payload, "paymentDate"),
            mode: field(row.payload, "paymentMode"),
            reference: field(row.payload, "transactionNumber"),
            status: (found?.payment ?? "Pending") as FeeStatus,
            receiptName: receipt?.name ?? null,
            receiptData: receipt?.data || null,
          };
        });
    }
    if (kind === "course-work")
      return doctoral ? courseGroups(doctoral.registrations) : [];
    const purposeKind = kind === "annual" ? null : kind;
    return (annual?.records ?? [])
      .filter((row) => {
        const purpose = row.payload.purpose ?? "";
        return purposeKind
          ? isSubmissionFeePurpose(purpose, purposeKind)
          : !isSubmissionFeePurpose(purpose);
      })
      .map((row) => ({
        id: row.id,
        ids: [row.id],
        name: row.scholarName,
        identifier: row.scholarIdentifier,
        detail: row.payload.purpose || kindCopy[kind].title,
        amount: row.payload.amount ? `₹${row.payload.amount}` : "",
        paidOn: row.payload.paidOn ?? row.createdAt.slice(0, 10),
        mode: row.payload.mode ?? "",
        reference: row.payload.transactionNumber ?? "",
        status: row.status as FeeStatus,
        receiptName: row.fileName,
        receiptData: row.fileData,
        load: () => loadRecordFile(row),
      }));
  })();

  const years = [...new Set(rows.map((row) => yearOf(row.paidOn)).filter(Boolean))]
    .sort()
    .reverse();
  const inScope = rows.filter(
    (row) =>
      (!year || yearOf(row.paidOn) === year) &&
      (!from || (row.paidOn && row.paidOn >= from)) &&
      (!to || (row.paidOn && row.paidOn <= to)) &&
      textMatches(query, [row.name, row.identifier, row.detail, row.reference]),
  );
  const pending = inScope.filter((row) => row.status !== "Approved");
  const approved = inScope.filter((row) => row.status === "Approved");
  const shown = tab === "pending" ? pending : approved;

  /** Verifies the payment, or returns it with the comment the scholar sees. */
  async function decide(row: FeeRow, status: "Approved" | "Returned", comment = "") {
    setBusyId(row.id);
    setNotice(null);
    let ok = false;
    if (kind === "registration") {
      const application = (applications ?? []).find((item) => item.id === row.id);
      const saved = application
        ? await decideApplicationFees([application], status, comment)
        : { ok: false as const, message: "That application was not found.", changed: 0 };
      ok = saved.ok;
      if (!saved.ok) setNotice(saved.message);
    } else if (kind === "course-work") {
      const saved = await setCourseWorkPayment(row.ids, status, comment);
      ok = saved.ok;
      if (!saved.ok) setNotice(saved.message);
    } else {
      const record = annual?.records.find((item) => item.id === row.id);
      ok = record
        ? await setScholarRecordStatus(
            record,
            status,
            status === "Returned" ? comment.trim() : "",
          )
        : false;
      if (!ok) setNotice("That payment could not be updated.");
    }
    setBusyId(null);
    if (ok) {
      setNotice(
        `Payment ${status === "Approved" ? "verified" : "returned"} for ${row.name}.${status === "Returned" ? " The scholar sees your comment and uploads the receipt again." : ""}`,
      );
      setReviewing(null);
    }
    return ok;
  }

  const range = [
    year ? `Year ${year}` : "",
    from ? `from ${formatIsoDate(from)}` : "",
    to ? `to ${formatIsoDate(to)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const copy = kindCopy[kind];

  return (
    <DeskPage kicker="Fee verification" title={copy.title}>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{copy.detail}</p>
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskTabs
        tabs={[
          { id: "pending", label: `Pending (${pending.length})` },
          { id: "approved", label: `Approved (${approved.length})` },
        ]}
        value={tab}
        onChange={(id) => setTab(id as "pending" | "approved")}
      />
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">Year</span>
          <NativeSelect value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All years</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">From date</span>
          <Input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold text-primary">To date</span>
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {year || from || to ? (
          <div className="sm:col-span-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setYear("");
                setFrom("");
                setTo("");
              }}
            >
              Clear dates
            </Button>
          </div>
        ) : null}
      </div>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={shown.length}
        total={rows.length}
        filename={`${kind}-fee-${tab}${year ? `-${year}` : ""}.csv`}
        title={`${copy.title} · ${tab === "pending" ? "Pending" : "Approved"}${range ? ` · ${range}` : ""}`}
        headers={[
          "Scholar",
          "Number / ID",
          "Details",
          "Amount",
          "Paid on",
          "Mode",
          "Reference",
          "Status",
        ]}
        rows={shown.map((row) => [
          row.name,
          row.identifier,
          row.detail,
          row.amount,
          row.paidOn ? formatIsoDate(row.paidOn) : "",
          row.mode,
          row.reference,
          row.status,
        ])}
      />
      <DeskTable
        headers={["Scholar", "Details", "Payment", "Receipt", "Status", ""]}
        empty={shown.length === 0}
      >
        {shown.map((row) => (
          <tr key={row.id} className="border-t border-border align-top">
            <td className="px-4 py-3">
              <p className="font-semibold text-primary">{row.name}</p>
              <p className="text-muted-foreground">{row.identifier}</p>
            </td>
            <td className="px-4 py-3">{row.detail || "—"}</td>
            <td className="px-4 py-3">
              <p>{row.amount || "—"}</p>
              <p className="text-muted-foreground">
                {row.paidOn ? formatIsoDate(row.paidOn) : "Date not given"}
                {row.mode ? ` · ${row.mode}` : ""}
              </p>
              {row.reference ? (
                <p className="font-mono text-xs text-muted-foreground">{row.reference}</p>
              ) : null}
            </td>
            <td className="px-4 py-3">
              <ViewFilesButton
                fileName={row.receiptName}
                data={row.receiptData}
                load={row.load}
              />
            </td>
            <td className="px-4 py-3">
              <StatusPill status={row.status} />
            </td>
            <td className="px-4 py-3">
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant={tab === "pending" ? "gold" : "outline"}
                  onClick={() => setReviewing(row)}
                >
                  {tab === "pending" ? "Review receipt" : "View receipt"}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </DeskTable>
      {reviewing ? (
        <ReceiptReview
          row={reviewing}
          busy={busyId === reviewing.id}
          canDecide={reviewing.status !== "Approved"}
          onClose={() => setReviewing(null)}
          onDecide={(status, comment) => decide(reviewing, status, comment)}
        />
      ) : null}
    </DeskPage>
  );
}

/**
 * The receipt page: the receipt is shown right here with the payment details, and Accounts
 * verifies the payment or returns it with a comment. A returned payment goes back to the
 * scholar, who uploads the receipt again and submits it for approval.
 */
function ReceiptReview({
  row,
  busy,
  canDecide,
  onClose,
  onDecide,
}: {
  row: FeeRow;
  busy: boolean;
  canDecide: boolean;
  onClose: () => void;
  onDecide: (status: "Approved" | "Returned", comment: string) => Promise<boolean>;
}) {
  const [data, setData] = useState<string | null>(row.receiptData);
  const [loading, setLoading] = useState(!row.receiptData && Boolean(row.load));
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (row.receiptData || !row.load) return;
    let alive = true;
    void row
      .load()
      .then(async (loaded) => {
        // A receipt kept in storage is read once so it can be shown here.
        const shown = loaded ? await fileAsDataUrl(loaded).catch(() => null) : null;
        if (alive) setData(shown);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [row]);

  const isPdf = Boolean(data?.startsWith("data:application/pdf"));
  const isImage = Boolean(data?.startsWith("data:image/"));

  return (
    <DeskModal
      title={`${row.name} · ${row.detail || "Payment"}`}
      size="lg"
      onClose={onClose}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="min-h-64 overflow-hidden rounded-xl border border-border bg-muted/30">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading the receipt…</p>
          ) : isImage && data ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data}
              alt="Payment receipt"
              className="mx-auto max-h-[28rem] w-auto"
            />
          ) : isPdf && data ? (
            <iframe title="Payment receipt" src={data} className="h-[28rem] w-full" />
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              {data
                ? "This receipt cannot be shown here."
                : "No receipt was attached to this payment."}
              {data ? (
                <div className="mt-2">
                  <ViewFilesButton fileName={row.receiptName} data={data} />
                </div>
              ) : null}
            </div>
          )}
        </div>
        <dl className="space-y-2 text-sm">
          {(
            [
              ["Scholar", row.name],
              ["Number / ID", row.identifier],
              ["Details", row.detail],
              ["Amount", row.amount],
              ["Paid on", row.paidOn ? formatIsoDate(row.paidOn) : ""],
              ["Mode", row.mode],
              ["Reference", row.reference],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </dt>
              <dd className="font-medium text-primary">{value || "—"}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Status
            </dt>
            <dd>
              <StatusPill status={row.status} />
            </dd>
          </div>
        </dl>
      </div>
      {canDecide ? (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {rejecting ? (
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-primary">
                Reason for returning the payment (the scholar sees this)
              </span>
              <textarea
                rows={3}
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  setError("");
                }}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          {error ? <p className="text-sm text-secondary">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {rejecting ? (
              <>
                <Button
                  type="button"
                  variant="maroon"
                  disabled={busy}
                  onClick={() => {
                    if (comment.trim().length < 5) {
                      setError(
                        "Write the reason in a few words so the scholar can correct it.",
                      );
                      return;
                    }
                    void onDecide("Returned", comment.trim());
                  }}
                >
                  Return with comment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejecting(false)}
                >
                  Back
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="gold"
                  disabled={busy}
                  onClick={() => void onDecide("Approved", "")}
                >
                  Approve payment
                </Button>
                <Button
                  type="button"
                  variant="maroon"
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </DeskModal>
  );
}
