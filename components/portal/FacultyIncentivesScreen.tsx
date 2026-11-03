"use client";

import { useCallback, useEffect, useState } from "react";

import { DeskModal, DeskPage, DeskTable, DeskTabs } from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  claimStatuses,
  countsAgainstCeiling,
  nextAcademicYear,
  positions,
  sciBands,
  type IncentiveClaim,
  type IncentiveRules,
} from "@/lib/faculty-incentives";
import {
  designations,
  formatDay,
  recordTitle,
  rupees,
  valueText,
  type ResearchRecord,
} from "@/lib/faculty-research";

type Row = {
  record: ResearchRecord;
  academicYear: string;
  computed: number;
  basis: string;
  claim: IncentiveClaim | null;
};
type Board = {
  year: string;
  years: string[];
  rows: Row[];
  rules: IncentiveRules;
  rulesFrom: string;
  claims: IncentiveClaim[];
  rights: { view: boolean; act: boolean; rules: boolean };
  banks: Record<
    string,
    {
      holderName: string;
      accountNo: string;
      ifsc: string;
      bankName: string;
      branch: string;
    }
  >;
};

async function call(input: string, init?: RequestInit) {
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

const money = (value: number) => rupees(value) || "₹0";
const option = (value: string) => ({ value, label: value });
const statusOf = (row: Row) =>
  row.claim?.status ??
  (row.computed <= 0
    ? "Not eligible"
    : row.record.approvedAt
      ? "Not claimed"
      : "Waiting for approval");
const tone = (status: string) =>
  status === "Paid" || status === "Approved"
    ? "gold"
    : status === "Rejected" || status === "Not eligible"
      ? "maroon"
      : "purple";

function ClaimDialog({
  row,
  board,
  onClose,
  onDone,
}: {
  row: Row;
  board: Board;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const claim = row.claim;
  const designation = valueText(row.record.values, "designation");
  const key =
    valueText(row.record.values, "mobile") ||
    valueText(row.record.values, "facultyName").toLowerCase();
  const ceiling = board.rules.ceilings[designation] ?? 0;
  const approvedSoFar = board.claims
    .filter(
      (item) =>
        item.facultyKey === key &&
        item.id !== claim?.id &&
        countsAgainstCeiling(item.status),
    )
    .reduce((sum, item) => sum + item.approved, 0);
  const [amount, setAmount] = useState(String(claim?.claimed ?? row.computed));
  const [remarks, setRemarks] = useState(claim?.remarks ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(action: string) {
    setBusy(true);
    setMessage("");
    const { ok, data } = await call("/api/faculty-research/incentives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, recordId: row.record.id, amount, remarks }),
    });
    setBusy(false);
    if (ok) onDone("Saved.");
    else setMessage(String(data.message ?? "Not saved."));
  }

  const v = row.record.values;
  const facts: [string, string][] = [
    ["Faculty", `${valueText(v, "facultyName")} · ${designation}`],
    ["Department", valueText(v, "department")],
    ["Publication", recordTitle("publication", v)],
    ["Type", valueText(v, "type")],
    ["Date", formatDay(valueText(v, "publishedOn") || valueText(v, "grantedOn"))],
    ["Policy", `${money(row.computed)} · ${row.basis}`],
    ["Ceiling " + row.academicYear, ceiling > 0 ? money(ceiling) : "Not set"],
    ["Approved so far", money(approvedSoFar)],
    [
      "Left under ceiling",
      ceiling > 0 ? money(Math.max(0, ceiling - approvedSoFar)) : "—",
    ],
  ];
  const bank = board.banks?.[key];
  facts.push([
    "Bank account",
    bank
      ? `${bank.holderName} · ${bank.bankName}${bank.branch ? `, ${bank.branch}` : ""} · IFSC ${bank.ifsc} · ${bank.accountNo}`
      : "Not given yet (the faculty member adds it on the faculty page)",
  ]);
  if (claim)
    facts.push([
      "Claim",
      `${claim.status} · claimed ${money(claim.claimed)} · approved ${money(claim.approved)}`,
    ]);

  return (
    <DeskModal title="Incentive" onClose={onClose} size="md">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {board.rights.act ? (
        <div className="space-y-3 border-t border-border pt-4">
          {!claim || claim.status === "Rejected" ? (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                Amount claimed (₹)
              </span>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-48"
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Remarks</span>
            <Textarea
              rows={2}
              maxLength={500}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </label>
          {message ? (
            <p role="alert" className="text-sm text-secondary">
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!claim || claim.status === "Rejected" ? (
              <Button type="button" disabled={busy} onClick={() => void act("claim")}>
                Record claim
              </Button>
            ) : null}
            {claim?.status === "Claimed" ? (
              <Button
                type="button"
                variant="gold"
                disabled={busy}
                onClick={() => void act("approve")}
              >
                Approve
              </Button>
            ) : null}
            {claim?.status === "Approved" ? (
              <Button
                type="button"
                variant="gold"
                disabled={busy}
                onClick={() => void act("pay")}
              >
                Mark paid
              </Button>
            ) : null}
            {claim && claim.status !== "Paid" && claim.status !== "Rejected" ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void act("reject")}
              >
                Reject
              </Button>
            ) : null}
            {claim && (claim.status === "Approved" || claim.status === "Rejected") ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void act("reopen")}
              >
                Reopen
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </DeskModal>
  );
}

function RulesEditor({
  board,
  onSaved,
}: {
  board: Board;
  onSaved: (message: string) => void;
}) {
  const [rules, setRules] = useState<IncentiveRules>(board.rules);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const edit = board.rights.rules;
  const cell = (value: number, set: (next: number) => void, label: string) => (
    <Input
      aria-label={label}
      inputMode="decimal"
      className="w-28"
      disabled={!edit}
      value={String(value)}
      onChange={(event) => set(Number(event.target.value.replace(/[^\d.]/g, "")) || 0)}
    />
  );

  async function save() {
    setBusy(true);
    setMessage("");
    const { ok, data } = await call("/api/faculty-research/incentives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rules", year: board.year, rules }),
    });
    setBusy(false);
    if (ok) onSaved(`Rules for ${board.year} saved.`);
    else setMessage(String(data.message ?? "Not saved."));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Academic year {board.year} (June to May).{" "}
        {board.rulesFrom === board.year
          ? "These rules are saved for this year."
          : board.rulesFrom
            ? `Not saved for this year yet: the ${board.rulesFrom} rules are used.`
            : "Not saved yet: the policy rates are used."}
      </p>
      <section className="space-y-2">
        <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
          Yearly ceiling per faculty member
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {designations.map((designation) => (
            <label
              key={designation}
              className="flex items-center justify-between gap-2 text-sm"
            >
              {designation}
              {cell(
                rules.ceilings[designation] ?? 0,
                (next) =>
                  setRules({
                    ...rules,
                    ceilings: { ...rules.ceilings, [designation]: next },
                  }),
                `Ceiling for ${designation}`,
              )}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          0 means not set: no claim is approved for that designation until a ceiling is
          set.
        </p>
      </section>
      <section className="space-y-2">
        <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
          SCI / Web of Science journals and book chapters (₹)
        </h3>
        <DeskTable headers={["Author position", ...sciBands]}>
          {positions.map((position, row) => (
            <tr key={position} className="border-t border-border">
              <td className="px-4 py-2">{position}</td>
              {sciBands.map((bandName, column) => (
                <td key={bandName} className="px-4 py-2">
                  {cell(
                    rules.sci[row][column],
                    (next) =>
                      setRules({
                        ...rules,
                        sci: rules.sci.map((line, at) =>
                          at === row
                            ? line.map((value, c) => (c === column ? next : value))
                            : line,
                        ),
                      }),
                    `${position} ${bandName}`,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </DeskTable>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
            Scopus journals and book chapters (₹)
          </h3>
          {positions.map((position, row) => (
            <label
              key={position}
              className="flex items-center justify-between gap-2 text-sm"
            >
              {position} position
              {cell(
                rules.scopus[row],
                (next) =>
                  setRules({
                    ...rules,
                    scopus: rules.scopus.map((value, at) => (at === row ? next : value)),
                  }),
                `Scopus ${position}`,
              )}
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <h3 className="text-[0.68rem] font-bold tracking-[0.16em] text-secondary uppercase">
            Books and patents (₹)
          </h3>
          <label className="flex items-center justify-between gap-2 text-sm">
            Technical book with ISBN
            {cell(rules.book, (next) => setRules({ ...rules, book: next }), "Book")}
          </label>
          <label className="flex items-center justify-between gap-2 text-sm">
            Product patent grant
            {cell(
              rules.patentGrant,
              (next) => setRules({ ...rules, patentGrant: next }),
              "Patent grant",
            )}
          </label>
        </div>
      </section>
      {message ? (
        <p role="alert" className="text-sm text-secondary">
          {message}
        </p>
      ) : null}
      {edit ? (
        <Button type="button" variant="gold" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : `Save rules for ${board.year}`}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only the administrator sets the rules.
        </p>
      )}
    </div>
  );
}

/** Faculty research › Publication incentives: claims per academic year, under each cadre's ceiling. */
export function FacultyIncentivesScreen() {
  const [year, setYear] = useState("");
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("claims");
  const [open, setOpen] = useState<Row | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");

  const load = useCallback(async (wanted: string) => {
    const { ok, data } = await call(
      `/api/faculty-research/incentives${wanted ? `?year=${wanted}` : ""}`,
    );
    if (ok) {
      setBoard(data as unknown as Board);
      setYear(String(data.year));
      setFailed("");
    } else setFailed(String(data.message ?? "The incentives could not be loaded."));
  }, []);

  useEffect(() => {
    // Reads the board once the page is shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load("");
  }, [load]);

  const rows = board?.rows ?? [];
  const shown = rows.filter((row) => {
    const v = row.record.values;
    return (
      filterMatches(status, statusOf(row)) &&
      filterMatches(department, valueText(v, "department")) &&
      filterMatches(designation, valueText(v, "designation")) &&
      textMatches(query, [
        valueText(v, "facultyName"),
        recordTitle("publication", v),
        valueText(v, "department"),
        row.basis,
      ])
    );
  });
  const years = board
    ? [
        ...new Set([
          ...board.years,
          board.year,
          nextAcademicYear(board.years[0] ?? board.year),
        ]),
      ]
        .sort()
        .reverse()
    : [];

  // Faculty-wise: what each person claimed and was approved this year, against the ceiling.
  const people = new Map<
    string,
    {
      name: string;
      designation: string;
      department: string;
      claimed: number;
      approved: number;
      paid: number;
      count: number;
      key: string;
    }
  >();
  for (const row of rows) {
    const v = row.record.values;
    const key = valueText(v, "mobile") || valueText(v, "facultyName").toLowerCase();
    const entry = people.get(key) ?? {
      key,
      name: valueText(v, "facultyName"),
      designation: valueText(v, "designation"),
      department: valueText(v, "department"),
      claimed: 0,
      approved: 0,
      paid: 0,
      count: 0,
    };
    entry.count += 1;
    if (row.claim && row.claim.status !== "Rejected") entry.claimed += row.claim.claimed;
    if (row.claim && countsAgainstCeiling(row.claim.status))
      entry.approved += row.claim.approved;
    if (row.claim?.status === "Paid") entry.paid += row.claim.approved;
    people.set(key, entry);
  }
  const personRows = [...people.values()]
    .filter(
      (person) =>
        filterMatches(department, person.department) &&
        filterMatches(designation, person.designation) &&
        textMatches(query, [person.name, person.department]),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => {
      const ceiling = board?.rules.ceilings[person.designation] ?? 0;
      return [
        person.name,
        person.designation,
        person.department,
        String(person.count),
        money(person.claimed),
        money(person.approved),
        money(person.paid),
        ceiling > 0 ? money(ceiling) : "Not set",
        ceiling > 0 ? money(Math.max(0, ceiling - person.approved)) : "—",
        // Where the incentive is credited (entered by the faculty member).
        board?.banks?.[person.key]
          ? `${board.banks[person.key].bankName} · ${board.banks[person.key].ifsc}`
          : "Not given",
        board?.banks?.[person.key]?.accountNo ?? "",
      ];
    });
  const claimHeaders = [
    "Faculty",
    "Designation",
    "Department",
    "Publication",
    "Type",
    "Basis",
    "Policy",
    "Claimed",
    "Approved",
    "Status",
  ];
  const claimRows = shown.map((row) => {
    const v = row.record.values;
    return [
      valueText(v, "facultyName"),
      valueText(v, "designation"),
      valueText(v, "department"),
      recordTitle("publication", v),
      valueText(v, "type"),
      row.basis,
      money(row.computed),
      row.claim ? money(row.claim.claimed) : "",
      row.claim ? money(row.claim.approved) : "",
      statusOf(row),
    ];
  });
  const personHeaders = [
    "Faculty",
    "Designation",
    "Department",
    "Publications",
    "Claimed",
    "Approved",
    "Paid",
    "Ceiling",
    "Left",
    "Bank · IFSC",
    "Account no.",
  ];
  const distinct = (pick: (row: Row) => string) =>
    [...new Set(rows.map(pick).filter(Boolean))].sort().map(option);
  const totals = {
    claimed: rows.reduce(
      (sum, row) =>
        sum + (row.claim && row.claim.status !== "Rejected" ? row.claim.claimed : 0),
      0,
    ),
    approved: rows.reduce(
      (sum, row) =>
        sum +
        (row.claim && countsAgainstCeiling(row.claim.status) ? row.claim.approved : 0),
      0,
    ),
    paid: rows.reduce(
      (sum, row) => sum + (row.claim?.status === "Paid" ? row.claim.approved : 0),
      0,
    ),
    waiting: rows.filter((row) => row.claim?.status === "Claimed").length,
  };

  return (
    <DeskPage
      kicker="Faculty research"
      title="Publication incentives"
      actions={
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Academic year</span>
          <NativeSelect
            aria-label="Academic year"
            className="w-36"
            value={year}
            onChange={(event) => void load(event.target.value)}
          >
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
      }
    >
      <DeskTabs
        tabs={[
          { id: "claims", label: "Claims" },
          { id: "faculty", label: "Faculty-wise" },
          { id: "rules", label: "Rules" },
        ]}
        value={tab}
        onChange={setTab}
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
      {!board && !failed ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {board ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Claims to approve", String(totals.waiting)],
            ["Claimed", money(totals.claimed)],
            ["Approved", money(totals.approved)],
            ["Paid", money(totals.paid)],
          ].map(([label, value]) => (
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
      ) : null}
      {board && tab === "rules" ? (
        <RulesEditor
          key={board.year + board.rulesFrom}
          board={board}
          onSaved={(message) => {
            setNotice(message);
            void load(board.year);
          }}
        />
      ) : null}
      {board && tab !== "rules" ? (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              ...(tab === "claims"
                ? [
                    {
                      id: "status",
                      label: "Status",
                      value: status,
                      options: [
                        "Waiting for approval",
                        "Not claimed",
                        ...claimStatuses,
                        "Not eligible",
                      ].map(option),
                      onChange: setStatus,
                    },
                  ]
                : []),
              {
                id: "department",
                label: "Department",
                value: department,
                options: distinct((row) => valueText(row.record.values, "department")),
                onChange: setDepartment,
              },
              {
                id: "designation",
                label: "Designation",
                value: designation,
                options: designations.map(option),
                onChange: setDesignation,
              },
            ]}
            shown={tab === "claims" ? shown.length : personRows.length}
            total={tab === "claims" ? rows.length : people.size}
            criteria={[`Academic year: ${board.year}`]}
            filename={`incentives-${board.year}${tab === "faculty" ? "-faculty" : ""}.xlsx`}
            title={`Publication incentives ${board.year}${tab === "faculty" ? " · faculty-wise" : ""}`}
            headers={tab === "claims" ? claimHeaders : personHeaders}
            rows={tab === "claims" ? claimRows : personRows}
          />
          {tab === "claims" ? (
            <DeskTable headers={[...claimHeaders, ""]} empty={shown.length === 0}>
              {shown.map((row, index) => (
                <tr key={row.record.id} className="border-t border-border align-top">
                  {claimRows[index].map((cell, column) => (
                    <td
                      key={column}
                      className={
                        column === 3 || column === 5
                          ? "max-w-xs px-4 py-3"
                          : column === 0
                            ? "px-4 py-3 font-semibold text-primary"
                            : "px-4 py-3 whitespace-nowrap"
                      }
                    >
                      {column === 9 ? <Badge variant={tone(cell)}>{cell}</Badge> : cell}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-readonly-allow
                      onClick={() => setOpen(row)}
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </DeskTable>
          ) : (
            <DeskTable headers={personHeaders} empty={personRows.length === 0}>
              {personRows.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  {row.map((cell, column) => (
                    <td
                      key={column}
                      className={
                        column === 0
                          ? "px-4 py-3 font-semibold text-primary"
                          : "px-4 py-3 whitespace-nowrap"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </DeskTable>
          )}
        </>
      ) : null}
      {open && board ? (
        <ClaimDialog
          row={open}
          board={board}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            setNotice(message);
            void load(board.year);
          }}
        />
      ) : null}
    </DeskPage>
  );
}
