"use client";

import { Copy, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DeskPage, DeskTable, DeskTabs, FormDialog } from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { ResearchImport } from "@/components/portal/ResearchImport";
import { ResearchRecordForm } from "@/components/portal/ResearchRecordForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  agencyOf,
  allFields,
  approvedLabel,
  isApproved,
  pendingLabel,
  balanceOf,
  campuses,
  designations,
  displayValue,
  emptyValues,
  formatDay,
  fundingAgencies,
  fundingStage,
  identityFields,
  indexingOptions,
  proposalStatuses,
  publicationTypes,
  receivedTotal,
  recordDate,
  recordYear,
  researchMenus,
  rupees,
  schoolNames,
  valueText,
  type ResearchKind,
  type ResearchRecord,
  type ResearchValues,
} from "@/lib/faculty-research";
import {
  crossReport,
  reportDimensions,
  reportMeasures,
} from "@/lib/faculty-research-report";
import { filterValues } from "@/lib/list-filter";
import { NativeSelect } from "@/components/ui/native-select";

type HistoryLine = { at: string; who: string; action: string; detail: string };

async function call(input: RequestInfo, init?: RequestInit) {
  try {
    const response = await fetch(input, { cache: "no-store", ...init });
    const data = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    return { ok: response.ok && Boolean(data?.ok), data: data ?? {} };
  } catch {
    return {
      ok: false,
      data: { message: "Check the connection and try again." } as Record<string, unknown>,
    };
  }
}

const option = (value: string) => ({ value, label: value });
const stamp = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";

function Editor({
  kind,
  record,
  start,
  office,
  onClose,
  onSaved,
  onApprove,
}: {
  kind: ResearchKind;
  record: ResearchRecord | null;
  start: ResearchValues;
  office: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Given to the Dean and the administrator: approve the record, or take the approval back. */
  onApprove?: (approve: boolean) => void;
}) {
  const [values, setValues] = useState<ResearchValues>(record ? record.values : start);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryLine[] | null>(null);

  useEffect(() => {
    if (!record || !office) return;
    void call(`/api/faculty-research?kind=${kind}&history=${record.id}`).then(
      ({ ok, data }) => {
        if (ok) setHistory((data.history as HistoryLine[]) ?? []);
      },
    );
  }, [kind, record, office]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { ok, data } = await call("/api/faculty-research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: record ? "update" : "create",
        kind,
        id: record?.id,
        record: values,
      }),
    });
    setBusy(false);
    if (ok) return onSaved(record ? "Saved." : "Added.");
    setErrors((data.errors as Record<string, string>) ?? {});
    setMessage(String(data.message ?? "The record could not be saved."));
  }

  return (
    <FormDialog
      title={record ? "Edit record" : "Add record"}
      onClose={onClose}
      onSubmit={save}
      busy={busy}
      size="lg"
      extraActions={
        record && onApprove ? (
          isApproved(record) ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onApprove(false)}
            >
              Withdraw approval
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={() => onApprove(true)}>
              Check &amp; approve
            </Button>
          )
        ) : null
      }
    >
      {record ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <ApprovalBadge record={record} />
          {record.approvedAt ? (
            <span className="text-muted-foreground">
              by {record.approvedBy || "the office"} on {stamp(record.approvedAt)}
            </span>
          ) : null}
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-secondary">
          {message}
        </p>
      ) : null}
      <ResearchRecordForm
        kind={kind}
        values={values}
        errors={errors}
        onChange={setValues}
        idPrefix="edit"
      />
      {record && office ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
            History
          </h3>
          {history === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((line, index) => (
                <li key={index} className="rounded-lg bg-muted/50 px-3 py-2">
                  <span className="font-semibold text-primary">{line.action}</span> ·{" "}
                  {stamp(line.at)} · {line.who}
                  <p className="mt-1 text-muted-foreground">{line.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </FormDialog>
  );
}

/** Table columns shown on screen, per kind. */
function screenColumns(kind: ResearchKind) {
  return kind === "publication"
    ? [
        "Date",
        "Name",
        "Department",
        "Type",
        "Title",
        "Journal / book",
        "Indexing",
        "Author",
        "Approval",
        "",
      ]
    : [
        "Submitted on",
        "Name",
        "Department",
        "Agency",
        "Project title",
        "Proposed",
        "Status",
        "Sanctioned",
        "Received",
        "Balance",
        "Approval",
        "",
      ];
}

function screenRow(kind: ResearchKind, record: ResearchRecord) {
  const v = record.values;
  if (kind === "publication") {
    return [
      formatDay(recordDate(kind, v)),
      valueText(v, "facultyName"),
      valueText(v, "department"),
      valueText(v, "type"),
      valueText(v, "title"),
      valueText(v, "source") ||
        (valueText(v, "type") === "Patent"
          ? `${valueText(v, "patentStatus")} · ${valueText(v, "patentNumber")}`
          : ""),
      displayValue(
        allFields(kind).find((f) => f.key === "indexing")!,
        v,
      ),
      `${valueText(v, "authorRole")} (${valueText(v, "authorPosition")}/${valueText(v, "authorCount")})`,
      approvalText(record),
    ];
  }
  const isAccepted = valueText(v, "status") === "Accepted";
  return [
    formatDay(valueText(v, "submittedOn")),
    valueText(v, "facultyName"),
    valueText(v, "department"),
    agencyOf(v),
    valueText(v, "projectTitle"),
    rupees(valueText(v, "amountProposed")),
    fundingStage(v),
    isAccepted ? rupees(valueText(v, "amountSanctioned")) : "",
    isAccepted ? rupees(receivedTotal(v)) || "₹0" : "",
    isAccepted ? rupees(balanceOf(v)) || "₹0" : "",
    approvalText(record),
  ];
}

const approvalText = (record: ResearchRecord) =>
  isApproved(record) ? approvedLabel : pendingLabel;

/** The approval of a record as a badge: gold once the Dean or the administrator approved it. */
export function ApprovalBadge({ record }: { record: ResearchRecord }) {
  return isApproved(record) ? (
    <Badge
      variant="gold"
      title={record.approvedBy ? `by ${record.approvedBy}` : undefined}
    >
      {approvedLabel}
    </Badge>
  ) : (
    <Badge variant="outline">{pendingLabel}</Badge>
  );
}

/** Every field, for the Excel and PDF downloads. */
function exportColumns(kind: ResearchKind) {
  const fields = allFields(kind);
  const headers = [...fields.map((field) => field.label)];
  if (kind === "proposal") headers.push("Amount received", "Balance", "Stage");
  headers.push("Approval", "Approved by", "Approved on", "Added on", "Added by");
  const row = (record: ResearchRecord) => {
    const cells = fields.map((field) => displayValue(field, record.values));
    if (kind === "proposal")
      cells.push(
        rupees(receivedTotal(record.values)),
        rupees(balanceOf(record.values)),
        fundingStage(record.values),
      );
    cells.push(
      approvalText(record),
      record.approvedBy ?? "",
      record.approvedAt ? stamp(record.approvedAt) : "",
      stamp(record.createdAt),
      record.source === "public" ? "Public page" : record.source,
    );
    return cells;
  };
  return { headers, row };
}

function YearSummary({
  kind,
  records,
}: {
  kind: ResearchKind;
  records: ResearchRecord[];
}) {
  const years = [...new Set(records.map((r) => recordYear(kind, r.values)))]
    .sort()
    .reverse();
  const headers =
    kind === "publication"
      ? ["Year", "Total", ...publicationTypes]
      : [
          "Year",
          "Proposals",
          "Accepted",
          "Rejected",
          "Proposed",
          "Sanctioned",
          "Received",
        ];
  const rows = years.map((year) => {
    const inYear = records.filter((r) => recordYear(kind, r.values) === year);
    if (kind === "publication")
      return [
        year || "—",
        String(inYear.length),
        ...publicationTypes.map((type) =>
          String(inYear.filter((r) => valueText(r.values, "type") === type).length),
        ),
      ];
    const sum = (pick: (v: ResearchValues) => number) =>
      rupees(inYear.reduce((total, r) => total + pick(r.values), 0)) || "₹0";
    const acceptedRows = inYear.filter(
      (r) => valueText(r.values, "status") === "Accepted",
    );
    return [
      year || "—",
      String(inYear.length),
      String(acceptedRows.length),
      String(inYear.filter((r) => valueText(r.values, "status") === "Rejected").length),
      sum((v) => Number(valueText(v, "amountProposed")) || 0),
      sum((v) =>
        valueText(v, "status") === "Accepted"
          ? Number(valueText(v, "amountSanctioned")) || 0
          : 0,
      ),
      sum((v) => (valueText(v, "status") === "Accepted" ? receivedTotal(v) : 0)),
    ];
  });
  return { headers, rows };
}

/** The count cards at the top of the office list; they follow the filters chosen below. */
function CountCards({
  kind,
  records,
}: {
  kind: ResearchKind;
  records: ResearchRecord[];
}) {
  const count = (test: (record: ResearchRecord) => boolean) =>
    String(records.filter(test).length);
  const type = (record: ResearchRecord) => valueText(record.values, "type");
  const indexed = (name: string) => (record: ResearchRecord) =>
    Array.isArray(record.values.indexing) &&
    (record.values.indexing as string[]).includes(name);
  const status = (record: ResearchRecord) => valueText(record.values, "status");
  const sum = (pick: (record: ResearchRecord) => number) =>
    rupees(records.reduce((total, record) => total + pick(record), 0)) || "₹0";
  const faculty = new Set(
    records.map(
      (record) =>
        valueText(record.values, "mobile") || valueText(record.values, "facultyName"),
    ),
  ).size;
  const cards: [string, string][] =
    kind === "publication"
      ? [
          ["Publications", String(records.length)],
          ["Faculty", String(faculty)],
          ["Journal articles", count((record) => type(record) === "Journal article")],
          [
            "Books & chapters",
            count((record) => type(record) === "Book" || type(record) === "Book chapter"),
          ],
          [
            "Conference papers",
            count((record) => type(record) === "Conference proceedings"),
          ],
          ["Patents", count((record) => type(record) === "Patent")],
          ["Scopus", count(indexed("Scopus"))],
          ["Web of Science", count(indexed("Web of Science"))],
        ]
      : [
          ["Proposals", String(records.length)],
          ["Faculty", String(faculty)],
          [
            "Submitted / under process",
            count(
              (record) =>
                status(record) === "Submitted" || status(record) === "Under process",
            ),
          ],
          ["Accepted", count((record) => status(record) === "Accepted")],
          ["Rejected", count((record) => status(record) === "Rejected")],
          [
            "Amount proposed",
            sum((record) => Number(valueText(record.values, "amountProposed")) || 0),
          ],
          [
            "Amount sanctioned",
            sum((record) =>
              status(record) === "Accepted"
                ? Number(valueText(record.values, "amountSanctioned")) || 0
                : 0,
            ),
          ],
          [
            "Amount received",
            sum((record) =>
              status(record) === "Accepted" ? receivedTotal(record.values) : 0,
            ),
          ],
        ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value]) => (
        <li
          key={label}
          className="rounded-xl border border-border bg-card p-4 shadow-card"
        >
          <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-secondary uppercase">
            {label}
          </p>
          <p className="mt-1 font-heading text-2xl text-primary">{value}</p>
        </li>
      ))}
    </ul>
  );
}

function useRecords(kind: ResearchKind) {
  const [records, setRecords] = useState<ResearchRecord[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [failed, setFailed] = useState("");
  const load = useCallback(async () => {
    const { ok, data } = await call(`/api/faculty-research?kind=${kind}`);
    if (ok) {
      setRecords((data.records as ResearchRecord[]) ?? []);
      setCanEdit(Boolean(data.canEdit));
      setCanUpload(Boolean(data.canUpload));
      setCanApprove(Boolean(data.canApprove));
      setFailed("");
    } else setFailed(String(data.message ?? "The records could not be loaded."));
  }, [kind]);
  useEffect(() => {
    // Reads the records once the page is shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return { records, canEdit, canUpload, canApprove, failed, load };
}

/** The research office list (administrator, Dean, staff with the menu): every record. */
export function FacultyResearchOffice({ kind }: { kind: ResearchKind }) {
  const menu = researchMenus[kind];
  const { records, canEdit, canUpload, canApprove, failed, load } = useRecords(kind);
  const [approval, setApproval] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);

  /** The Dean or the administrator approves records, or takes an approval back. */
  async function approve(ids: string[], yes: boolean) {
    setApproving(true);
    const { ok, data } = await call("/api/faculty-research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: yes ? "approve" : "withdraw-approval", kind, ids }),
    });
    setApproving(false);
    if (ok) {
      setSelected([]);
      setEditing(null);
      setNotice(
        yes
          ? `${String(data.count)} record(s) checked and approved.`
          : "Approval withdrawn.",
      );
      void load();
    } else setNotice(String(data.message ?? "Not saved."));
  }
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState("date");
  const dimensions = reportDimensions(kind);
  const measures = reportMeasures(kind);
  const [rowDim, setRowDim] = useState("department");
  const [subDim, setSubDim] = useState("");
  const [colDim, setColDim] = useState("year");
  const [measureId, setMeasureId] = useState("count");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");
  const [indexing, setIndexing] = useState("");
  const [agency, setAgency] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [school, setSchool] = useState("");
  const [campus, setCampus] = useState("");
  const [designation, setDesignation] = useState("");
  const [editing, setEditing] = useState<ResearchRecord | "new" | null>(null);
  const [notice, setNotice] = useState("");

  const all = useMemo(() => records ?? [], [records]);
  const shown = all.filter((record) => {
    const v = record.values;
    const date = recordDate(kind, v);
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;
    if (!filterMatches(year, recordYear(kind, v))) return false;
    if (!filterMatches(department, valueText(v, "department"))) return false;
    if (!filterMatches(school, valueText(v, "school"))) return false;
    if (!filterMatches(campus, valueText(v, "campus"))) return false;
    if (!filterMatches(designation, valueText(v, "designation"))) return false;
    if (!filterMatches(approval, approvalText(record))) return false;
    if (kind === "publication") {
      if (!filterMatches(type, valueText(v, "type"))) return false;
      const chosen = filterValues(indexing);
      const has = Array.isArray(v.indexing) ? (v.indexing as string[]) : [];
      if (chosen.length && !chosen.some((item) => has.includes(item))) return false;
    } else {
      if (!filterMatches(agency, valueText(v, "agency"))) return false;
      if (!filterMatches(status, valueText(v, "status"))) return false;
    }
    return textMatches(
      query,
      Object.values(v).map((item) => (typeof item === "string" ? item : "")),
    );
  });

  const distinct = (key: string, base: readonly string[] = []) =>
    [
      ...new Set([...base, ...all.map((r) => valueText(r.values, key)).filter(Boolean)]),
    ].map(option);
  const years = [...new Set(all.map((r) => recordYear(kind, r.values)).filter(Boolean))]
    .sort()
    .reverse()
    .map(option);
  const filters = [
    { id: "year", label: "Year", value: year, options: years, onChange: setYear },
    {
      id: "approval",
      label: "Approval",
      value: approval,
      options: [pendingLabel, approvedLabel].map(option),
      onChange: setApproval,
    },
    ...(kind === "publication"
      ? [
          {
            id: "type",
            label: "Type",
            value: type,
            options: publicationTypes.map(option),
            onChange: setType,
          },
          {
            id: "indexing",
            label: "Indexing",
            value: indexing,
            options: indexingOptions.map(option),
            onChange: setIndexing,
          },
        ]
      : [
          {
            id: "agency",
            label: "Agency",
            value: agency,
            options: fundingAgencies.map(option),
            onChange: setAgency,
          },
          {
            id: "status",
            label: "Status",
            value: status,
            options: proposalStatuses.map(option),
            onChange: setStatus,
          },
        ]),
    {
      id: "department",
      label: "Department",
      value: department,
      options: distinct("department"),
      onChange: setDepartment,
    },
    {
      id: "school",
      label: "School",
      value: school,
      options: distinct("school", schoolNames),
      onChange: setSchool,
    },
    {
      id: "campus",
      label: "Campus",
      value: campus,
      options: distinct("campus", campuses),
      onChange: setCampus,
    },
    {
      id: "designation",
      label: "Designation",
      value: designation,
      options: distinct("designation", designations),
      onChange: setDesignation,
    },
  ];
  const criteria = [
    ...(from ? [`From: ${formatDay(from)}`] : []),
    ...(to ? [`To: ${formatDay(to)}`] : []),
  ];
  const full = exportColumns(kind);
  const yearly = YearSummary({ kind, records: shown });
  const pick = (id: string) => dimensions.find((dim) => dim.id === id) ?? null;
  const cross = crossReport(
    shown,
    [
      pick(rowDim) ?? dimensions[0],
      ...(subDim && subDim !== rowDim ? [pick(subDim)!] : []),
    ],
    colDim && colDim !== rowDim && colDim !== subDim ? pick(colDim) : null,
    measures.find((item) => item.id === measureId) ?? measures[0],
  );
  const summary = view === "cross" ? cross : yearly;
  const slug = menu.adminHref.split("/").pop() ?? "report";
  const columns = screenColumns(kind);
  const publicLink =
    typeof window === "undefined"
      ? menu.publicHref
      : `${window.location.origin}${menu.publicHref}`;

  return (
    <DeskPage
      kicker="Faculty research"
      title={menu.label}
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-readonly-allow
            onClick={() => {
              void navigator.clipboard?.writeText(publicLink).then(
                () => setNotice(`Public link copied: ${publicLink}`),
                () => setNotice(`Public link: ${publicLink}`),
              );
            }}
          >
            <Copy className="size-4" /> Copy public link
          </Button>
          {canUpload ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUploading(true)}
            >
              <Upload className="size-4" /> Upload sheet
            </Button>
          ) : null}
          {canEdit ? (
            <Button type="button" size="sm" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add record
            </Button>
          ) : null}
        </>
      }
    >
      {records !== null ? <CountCards kind={kind} records={shown} /> : null}
      <DeskTabs
        tabs={[
          { id: "date", label: "Date-wise" },
          { id: "year", label: "Year-wise" },
          { id: "cross", label: "Cross report" },
        ]}
        value={view}
        onChange={setView}
      />
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-secondary">
          {failed}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-44"
            aria-label="From date"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-44"
            aria-label="To date"
          />
        </label>
        {from || to ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear dates
          </Button>
        ) : null}
      </div>
      {view === "cross" ? (
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Rows", rowDim, setRowDim, false],
              ["Then by", subDim, setSubDim, true],
              ["Columns", colDim, setColDim, true],
            ] as const
          ).map(([label, value, set, optional]) => (
            <label key={label} className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
              <NativeSelect
                aria-label={label}
                value={value}
                onChange={(event) => set(event.target.value)}
              >
                {optional ? <option value="">None</option> : null}
                {dimensions.map((dim) => (
                  <option key={dim.id} value={dim.id}>
                    {dim.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Show</span>
            <NativeSelect
              aria-label="Show"
              value={measureId}
              onChange={(event) => setMeasureId(event.target.value)}
            >
              {measures.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={filters}
        shown={shown.length}
        total={all.length}
        criteria={criteria}
        filename={`${slug}${view === "year" ? "-year-wise" : view === "cross" ? "-report" : ""}.xlsx`}
        title={
          view === "year"
            ? `${menu.label} · year-wise`
            : view === "cross"
              ? `${menu.label} · ${cross.title}`
              : menu.label
        }
        headers={view === "date" ? full.headers : summary.headers}
        rows={view === "date" ? shown.map(full.row) : summary.rows}
        pdfHeaders={view === "date" ? columns.slice(0, -1) : undefined}
        pdfRows={view === "date" ? shown.map((r) => screenRow(kind, r)) : undefined}
      />
      {records === null && !failed ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {records !== null && view === "cross" ? (
        <DeskTable headers={cross.headers} empty={shown.length === 0}>
          {cross.rows.map((row, at) => (
            <tr
              key={at}
              className={
                at === cross.rows.length - 1
                  ? "border-t-2 border-border bg-muted/50 font-semibold"
                  : "border-t border-border"
              }
            >
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={
                    index === row.length - 1
                      ? "px-4 py-2 font-semibold text-primary"
                      : "px-4 py-2"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </DeskTable>
      ) : null}
      {records !== null && view === "year" ? (
        <DeskTable headers={summary.headers} empty={summary.rows.length === 0}>
          {summary.rows.map((row) => (
            <tr key={row[0]} className="border-t border-border">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={
                    index === 0 ? "px-4 py-3 font-semibold text-primary" : "px-4 py-3"
                  }
                >
                  {index === 0 && row[0] !== "—" ? (
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        setYear(row[0]);
                        setView("date");
                      }}
                    >
                      {cell}
                    </button>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </DeskTable>
      ) : null}
      {records !== null && view === "date" && canApprove ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setSelected(
                shown.filter((record) => !isApproved(record)).map((record) => record.id),
              )
            }
          >
            Select all waiting ({shown.filter((record) => !isApproved(record)).length})
          </Button>
          {selected.length > 0 ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="gold"
                disabled={approving}
                onClick={() => void approve(selected, true)}
              >
                {approving ? "Saving…" : `Approve selected (${selected.length})`}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setSelected([])}
              >
                Clear selection
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {records !== null && view === "date" ? (
        <DeskTable headers={columns} empty={shown.length === 0}>
          {shown.map((record) => (
            <tr key={record.id} className="border-t border-border align-top">
              {screenRow(kind, record).map((cell, index) => (
                <td
                  key={index}
                  className={
                    index === 1
                      ? "px-4 py-3 font-semibold text-primary"
                      : index === 4
                        ? "max-w-xs px-4 py-3"
                        : "px-4 py-3 whitespace-nowrap"
                  }
                >
                  {cell === approvedLabel || cell === pendingLabel ? (
                    <ApprovalBadge record={record} />
                  ) : kind === "proposal" && index === 6 ? (
                    <Badge
                      variant={
                        cell === "Rejected"
                          ? "maroon"
                          : cell === "Submitted" || cell === "Under process"
                            ? "purple"
                            : "gold"
                      }
                    >
                      {cell}
                    </Badge>
                  ) : (
                    cell
                  )}
                </td>
              ))}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {canApprove && !isApproved(record) ? (
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      aria-label={`Select ${valueText(record.values, "facultyName")} for approval`}
                      checked={selected.includes(record.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, record.id]
                            : current.filter((id) => id !== record.id),
                        )
                      }
                    />
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-readonly-allow
                    onClick={() => setEditing(record)}
                  >
                    {canEdit ? "Edit" : "View"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </DeskTable>
      ) : null}
      {uploading ? (
        <ResearchImport
          kind={kind}
          onClose={() => setUploading(false)}
          onDone={() => void load()}
        />
      ) : null}
      {editing ? (
        <Editor
          kind={kind}
          record={editing === "new" ? null : editing}
          start={emptyValues(kind)}
          office
          onApprove={
            canApprove && editing !== "new"
              ? (yes) => void approve([editing.id], yes)
              : undefined
          }
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            void load();
          }}
        />
      ) : null}
    </DeskPage>
  );
}

/** A faculty member's (supervisor's) own records: add only. */
export function FacultyResearchMine({ kind }: { kind: ResearchKind }) {
  const menu = researchMenus[kind];
  const { records, failed, load } = useRecords(kind);
  const [editing, setEditing] = useState<"new" | null>(null);
  const [notice, setNotice] = useState("");
  const all = records ?? [];
  // Faculty add records; a correction is made by the research office.
  const columns = screenColumns(kind).slice(0, -1);
  // A new record starts with the personal details of the last one.
  const start = emptyValues(kind);
  if (all[0])
    for (const field of identityFields) start[field.key] = all[0].values[field.key] ?? "";

  return (
    <DeskPage
      kicker="Faculty research"
      title={menu.memberLabel}
      actions={
        <Button type="button" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Add record
        </Button>
      }
    >
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-sm text-secondary">
          {failed}
        </p>
      ) : null}
      {records === null && !failed ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {records !== null ? (
        <DeskTable headers={columns} empty={all.length === 0}>
          {all.map((record) => (
            <tr key={record.id} className="border-t border-border align-top">
              {screenRow(kind, record).map((cell, index) => (
                <td
                  key={index}
                  className={
                    index === 4 ? "max-w-xs px-4 py-3" : "px-4 py-3 whitespace-nowrap"
                  }
                >
                  {cell === approvedLabel || cell === pendingLabel ? (
                    <ApprovalBadge record={record} />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </DeskTable>
      ) : null}
      {editing ? (
        <Editor
          kind={kind}
          record={null}
          start={start}
          office={false}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
            void load();
          }}
        />
      ) : null}
    </DeskPage>
  );
}
