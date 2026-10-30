"use client";

import { ChevronDown, IndianRupee, PencilLine, Search, UserPlus, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { PersonalDetailsPanel } from "@/components/portal/PersonalDetailsPanel";
import { ProfileCard } from "@/components/portal/ProfileCard";
import { useScholarEntry } from "@/components/portal/ScholarEntryDialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { researchRegister } from "@/data/research-register";
import { committeeSummary, submissionSummary } from "@/lib/approval-flow";
import { batchById } from "@/lib/batches";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  attendanceKey,
  colloquiumMarked,
  examSessionLabel,
  latestViva,
  paperOf,
  resultFor,
  resultsFor,
} from "@/lib/doctoral";
import { feeLedger } from "@/lib/fee-ledger";
import { sameId } from "@/lib/office";
import { isPassedOut, registerScholarsInOrder, scholarSignInId } from "@/lib/register";
import { useScholarReports } from "@/lib/use-report-sources";
import { useScholarProfiles } from "@/lib/use-scholar-profile";
import { usePreviewSession } from "@/lib/use-preview-session";
import { cn, formatInr } from "@/lib/utils";

type Candidate = {
  identifier: string;
  name: string;
  registration: string;
  batch: string;
  department: string;
  guide: string;
  mode: string;
  passedOut: boolean;
};

const tabs = [
  { id: "personal", label: "Personal details" },
  { id: "fee", label: "Fee details" },
  { id: "rac", label: "RAC" },
  { id: "course", label: "Course work & results" },
  { id: "committee", label: "Doctoral committees" },
  { id: "six", label: "Six-month reports" },
  { id: "colloquium", label: "Colloquium attendance" },
  { id: "publications", label: "Publications" },
  { id: "thesis", label: "Synopsis, thesis & viva" },
] as const;
type TabId = (typeof tabs)[number]["id"];

function Table({
  headers,
  rows,
  empty,
}: {
  headers: readonly string[];
  rows: readonly (readonly (string | number)[])[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted text-primary">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-4 text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-border align-top">
                {row.map((cell, at) => (
                  <td key={at} className="px-3 py-2">
                    {String(cell) || "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const when = (iso: string) => (iso ? formatIsoDate(iso.slice(0, 10)) : "");

/**
 * Scholar information: type a scholar's name, registration number or e-mail, pick the scholar from
 * the list, and read what the scholar sees in the portal, one topic at a time (personal details,
 * fee, RAC, course work, committees, reports, colloquium, publications, synopsis and thesis). The
 * research office enters the personal details, the fee already paid and the RAC from the tabs
 * they belong to.
 */
export function ScholarInformationViewer() {
  const session = usePreviewSession();
  const data = useScholarReports();
  const profiles = useScholarProfiles();
  const asked = useSearchParams().get("scholar") ?? "";
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string>(asked);
  const [tab, setTab] = useState<TabId>("personal");
  const [notice, setNotice] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const entry = useScholarEntry((message) => setNotice(message || null));
  const office = Boolean(session && ["admin", "staff", "dean"].includes(session.role));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const candidates = useMemo<Candidate[]>(() => {
    const seen = new Set<string>();
    return [...registerScholarsInOrder(), ...researchRegister.scholars].flatMap((scholar) => {
      const identifier = scholarSignInId(scholar);
      if (seen.has(identifier.toLowerCase())) return [];
      seen.add(identifier.toLowerCase());
      const profile = profiles.profileOf(identifier);
      return [
        {
          identifier,
          name: scholar.name,
          registration: scholar.registrationNumber || scholar.fileNumber || "",
          batch: batchById(scholar.batchId)?.name ?? "",
          department: profile.department || scholar.department,
          guide: profile.guide || scholar.guideName,
          mode: profile.mode,
          passedOut: isPassedOut(identifier, scholar.name),
        },
      ];
    });
  }, [profiles]);

  if (!data.ready) {
    return <p className="text-sm text-muted-foreground">Loading scholars…</p>;
  }

  const needle = text.trim().toLowerCase();
  const matches =
    needle.length < 2
      ? []
      : candidates
          .filter((item) =>
            [item.name, item.registration, item.identifier, item.department, item.guide]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          )
          .slice(0, 40);
  const scholar =
    candidates.find((item) => sameId(item.identifier, picked)) ?? null;
  const report = scholar
    ? (data.reports.find((item) => sameId(item.identifier, scholar.identifier)) ?? null)
    : null;
  const doctoral = data.sources.doctoral;
  const mine = <T extends { scholarIdentifier: string }>(list: readonly T[]) =>
    scholar ? list.filter((item) => sameId(item.scholarIdentifier, scholar.identifier)) : [];
  const personalRecord =
    mine(data.sources.personal ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
    null;

  function choose(item: Candidate) {
    setPicked(item.identifier);
    setText(item.name);
    setOpen(false);
    setTab("personal");
    setNotice(null);
  }

  const ledger = scholar
    ? feeLedger(scholar.identifier, scholar.name, data.sources.payments, clientToday())
    : null;

  return (
    <section className="space-y-4">
      <header className="border-b border-border pb-4">
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Scholar register
        </p>
        <h1 className="mt-1 font-heading text-3xl text-primary">Scholar information</h1>
      </header>

      <div ref={box} className="relative">
        <label className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <span className="text-sm font-semibold text-primary">Scholar name</span>
          <span className="relative min-w-[16rem] flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={text}
              placeholder="Type a name, registration number or e-mail"
              aria-label="Scholar name"
              autoComplete="off"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setText(event.target.value);
                setOpen(true);
              }}
              className="h-10 w-full rounded-lg border border-input bg-background pr-9 pl-9 text-sm outline-none focus:border-primary"
            />
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        </label>
        {open && needle.length >= 2 ? (
          <div
            role="listbox"
            aria-label="Matching scholars"
            className="absolute right-0 left-0 z-40 mt-1 max-h-96 overflow-auto rounded-xl border border-border bg-card shadow-lift"
          >
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-muted text-primary">
                <tr>
                  {["Scholar", "Registration No.", "Batch", "Department", "Guide", "Mode", "Status"].map(
                    (header) => (
                      <th key={header} className="px-3 py-2 font-semibold whitespace-nowrap">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-muted-foreground">
                      No scholar matches “{text.trim()}”.
                    </td>
                  </tr>
                ) : (
                  matches.map((item) => (
                    <tr
                      key={item.identifier}
                      role="option"
                      aria-selected={sameId(item.identifier, picked)}
                      tabIndex={0}
                      className="cursor-pointer border-t border-border hover:bg-muted"
                      onClick={() => choose(item)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") choose(item);
                      }}
                    >
                      <td className="px-3 py-2 font-medium text-primary">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{item.registration || "—"}</td>
                      <td className="px-3 py-2">{item.batch || "—"}</td>
                      <td className="px-3 py-2">{item.department || "—"}</td>
                      <td className="px-3 py-2">{item.guide || "—"}</td>
                      <td className="px-3 py-2">{item.mode || "—"}</td>
                      <td className="px-3 py-2 font-semibold">
                        {item.passedOut ? "Passed out" : "Active"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-primary"
        >
          {notice}
        </p>
      ) : null}

      {!scholar ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-card">
          Type at least two letters of a scholar&apos;s name, registration number or e-mail,
          then choose the scholar from the list to see what the scholar sees in the portal.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="Scholar information" className="space-y-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                data-readonly-allow=""
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => setTab(item.id)}
                className={cn(
                  "block w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
                  tab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-primary hover:bg-primary/10",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
              <div>
                <p className="text-lg font-semibold text-primary">{scholar.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    scholar.registration,
                    scholar.batch,
                    scholar.department,
                    scholar.guide ? `Guide ${scholar.guide}` : "",
                    scholar.mode,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Badge variant={scholar.passedOut ? "outline" : "gold"}>
                {scholar.passedOut ? "Passed out" : "Active"}
              </Badge>
            </div>

            {tab === "personal" ? (
              <div className="space-y-4">
                {office ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      onClick={() =>
                        entry.details(scholar.identifier, scholar.name, personalRecord ?? undefined)
                      }
                    >
                      {personalRecord ? (
                        <PencilLine className="size-4" aria-hidden="true" />
                      ) : (
                        <UserPlus className="size-4" aria-hidden="true" />
                      )}
                      {personalRecord ? "Correct details" : "Enter details"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {personalRecord
                        ? personalRecord.status === "Approved"
                          ? "Details entered and locked."
                          : "Sent by the scholar; review and lock them."
                        : "No details entered yet."}
                    </span>
                  </div>
                ) : null}
                <ProfileCard role="scholar" identifier={scholar.identifier} name={scholar.name} />
                <PersonalDetailsPanel
                  role="scholar"
                  identifier={scholar.identifier}
                  name={scholar.name}
                />
              </div>
            ) : null}

            {tab === "fee" ? (
              <div className="space-y-3">
                {office ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => entry.fee(scholar.identifier, scholar.name)}
                  >
                    <IndianRupee className="size-4" aria-hidden="true" />
                    Fee paid
                  </Button>
                ) : null}
                {ledger ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Outstanding across the years that have started:{" "}
                      <span className="font-semibold text-primary">
                        ₹{formatInr(ledger.outstanding)}
                      </span>
                    </p>
                    <Table
                      headers={["Fee year", "Period", "Annual fee (₹)", "Paid (₹)", "Waiting (₹)", "Balance (₹)", "Status"]}
                      rows={ledger.plan.map((year) => [
                        year.label,
                        `${when(year.from)} – ${when(year.to)}`,
                        formatInr(year.amount),
                        formatInr(year.paid),
                        formatInr(year.pending),
                        formatInr(year.balance),
                        year.status,
                      ])}
                      empty="No fee year has started."
                    />
                    <Table
                      headers={["Fee year", "Instalment", "Amount (₹)", "Paid on", "Mode", "Reference", "Checked"]}
                      rows={ledger.plan.flatMap((year) =>
                        year.installments.map((item) => [
                          year.label,
                          item.number,
                          formatInr(item.amount),
                          when(item.paidOn),
                          item.mode,
                          item.reference,
                          item.record.status === "Approved" ? "Verified" : item.record.status,
                        ]),
                      )}
                      empty="No payment is recorded yet."
                    />
                  </>
                ) : null}
              </div>
            ) : null}

            {tab === "rac" ? (
              <div className="space-y-3">
                {office && report?.rac === "Not constituted" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!entry.rac(scholar.identifier)) {
                        setNotice(`${scholar.name}: allot a guide first, then enter the RAC.`);
                      }
                    }}
                  >
                    <Users className="size-4" aria-hidden="true" />
                    Enter RAC
                  </Button>
                ) : null}
                <p className="text-sm">
                  RAC: <span className="font-semibold text-primary">{report?.rac ?? "—"}</span>
                </p>
                <Table
                  headers={["Kind", "Status", "Internal member", "External member", "Decided on", "Entered by"]}
                  rows={mine(data.sources.proposals).map((item) => [
                    item.kind === "constitution" ? "Constitution" : "Reconstitution",
                    item.status === "Submitted"
                      ? "With the Dean"
                      : item.status === "With VC"
                        ? "With the Vice Chancellor"
                        : item.status,
                    item.selectedInternal ||
                      item.nominees.filter((n) => n.side === "internal").map((n) => n.name).join(", "),
                    item.selectedExternal ||
                      item.nominees.filter((n) => n.side === "external").map((n) => n.name).join(", "),
                    when(item.vcOn || item.decidedOn),
                    item.officeEntry ? item.enteredBy : item.supervisorName,
                  ])}
                  empty="No RAC is entered or nominated yet."
                />
              </div>
            ) : null}

            {tab === "course" ? (
              <Table
                headers={["Semester", "Code", "Subject", "Attempt", "Fee", "COE", "Latest result", "Sittings"]}
                rows={mine(doctoral.registrations).map((row) => {
                  const paper = paperOf(doctoral, row);
                  const result = resultFor(doctoral, row.id);
                  return [
                    row.semester,
                    paper.code,
                    paper.name,
                    row.arrear ? "Arrear" : "Regular",
                    row.paymentStatus === "Approved" ? "Verified" : row.paymentStatus,
                    row.coeStatus ? "Forwarded" : "Not forwarded",
                    result
                      ? `${result.outcome === "AAA" ? "Absent" : result.outcome}${examSessionLabel(result) ? ` · ${examSessionLabel(result)}` : ""}`
                      : "Result awaited",
                    resultsFor(doctoral, row.id).length,
                  ];
                })}
                empty="No course-work paper is registered."
              />
            ) : null}

            {tab === "committee" ? (
              <div className="space-y-3">
                <Table
                  headers={["Committee", "Register / ERP status"]}
                  rows={[
                    ["First doctoral committee", report?.firstDc ?? ""],
                    ["Second (confirmation)", report?.confirmation ?? ""],
                    ["Third doctoral committee", report?.thirdDc ?? ""],
                  ]}
                  empty=""
                />
                <Table
                  headers={["Committee", "Meeting", "Report", "Status", "Research title"]}
                  rows={mine(doctoral.committees).map((item) => [
                    ({ first: "First", second: "Second", third: "Third" } as Record<string, string>)[item.kind] ?? item.kind,
                    when(item.meetingOn),
                    item.fileName,
                    committeeSummary(item).label,
                    item.researchTitle ?? "",
                  ])}
                  empty="No committee report is filed in the ERP."
                />
              </div>
            ) : null}

            {tab === "six" ? (
              <Table
                headers={["Period", "Submitted", "Status", "Approved on", "Remarks"]}
                rows={mine(data.sources.sixMonth).map((item) => [
                  item.payload.period ?? "",
                  when(item.createdAt),
                  item.status,
                  item.payload.approvedOn ? when(item.payload.approvedOn) : "",
                  item.payload.remarks ?? "",
                ])}
                empty={`No six-month report is filed.${report ? ` Approved ${report.sixMonthApproved} of ${report.sixMonthDue} due.` : ""}`}
              />
            ) : null}

            {tab === "colloquium" ? (
              <div className="space-y-3">
                {report ? (
                  <p className="text-sm">
                    Attended{" "}
                    <span className="font-semibold text-primary">
                      {report.colloquium.attended}
                    </span>
                    , absent {report.colloquium.absent}; minimum for {report.mode.toLowerCase()}:{" "}
                    {report.colloquium.required} ({report.colloquium.status}).
                  </p>
                ) : null}
                <Table
                  headers={["Event", "Date", "Venue", "Attendance"]}
                  rows={doctoral.colloquia
                    .filter((event) =>
                      event.scholars.some((person) => sameId(person.identifier, scholar.identifier)),
                    )
                    .map((event) => [
                      event.name,
                      when(event.date),
                      event.venue,
                      colloquiumMarked(event)
                        ? event.attendance[attendanceKey("scholar", scholar.identifier)] ===
                          "Present"
                          ? "Present"
                          : "Absent"
                        : "Not marked yet",
                    ])}
                  empty="The scholar is not invited to a colloquium yet."
                />
              </div>
            ) : null}

            {tab === "publications" ? (
              <Table
                headers={["Type", "Title", "Journal / book / conference", "Indexed in", "Year", "Status"]}
                rows={mine(data.sources.publications).map((item) => [
                  item.payload.kind ?? "",
                  item.payload.title ?? "",
                  item.payload.journal ?? "",
                  item.payload.indexing ?? "",
                  item.payload.year ?? "",
                  item.status,
                ])}
                empty="No publication is filed."
              />
            ) : null}

            {tab === "thesis" ? (
              <div className="space-y-3">
                <Table
                  headers={["Stage", "Status", "Filed on", "Details"]}
                  rows={[
                    ...mine(doctoral.synopses).map((item) => [
                      "Synopsis",
                      submissionSummary(item).label,
                      when(item.createdAt),
                      item.fileName,
                    ]),
                    ...mine(doctoral.theses).map((item) => [
                      "Thesis",
                      submissionSummary(item).label,
                      when(item.createdAt),
                      [item.title, item.domain].filter(Boolean).join(" · "),
                    ]),
                    ...mine(doctoral.vivas).map((item) => [
                      "Viva",
                      item.status,
                      when(item.scheduledOn),
                      item.venue,
                    ]),
                  ]}
                  empty="No synopsis, thesis or viva is filed."
                />
                <p className="text-sm text-muted-foreground">
                  Plagiarism: {report?.plagiarism || "—"} · Latest viva:{" "}
                  {latestViva(doctoral, scholar.identifier)?.status ?? "—"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
      {entry.dialogs}
    </section>
  );
}
