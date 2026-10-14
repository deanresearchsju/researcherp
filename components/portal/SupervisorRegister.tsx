"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { researchRegister, type ResearchSupervisor } from "@/data/research-register";
import { currentOffice, subscribeOffice } from "@/lib/office";
import { openOfficeView } from "@/lib/office-view";
import {
  currentQuotas,
  guideFigures,
  sameGuide,
  saveApprovedQuota,
  subscribeRegister,
} from "@/lib/register";
import { decideSupervisorApplication, type StoredApplication } from "@/lib/records";
import type { Json } from "@/types/database";

function payloadText(payload: Json, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function payloadNumber(payload: Json, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function decisionSchema(status: "Approved" | "Rejected") {
  return z.object({
    remarks: z
      .string()
      .trim()
      .max(500, "Use 500 characters or fewer.")
      .refine((value) => status === "Approved" || value.length >= 2, "Enter the reason."),
    quota: z
      .string()
      .trim()
      .refine((value) => {
        if (status !== "Approved") return true;
        const quota = Number(value);
        return Number.isInteger(quota) && quota >= 0 && quota <= 30;
      }, "Enter the approved quota."),
  });
}

type DecisionValues = { remarks: string; quota: string };

function recognisedGuide(
  name: string,
  department: string,
  designation: string,
  quota: number,
): ResearchSupervisor {
  return {
    serialNo: 0,
    name,
    supervisorId: "",
    department,
    designation,
    researchArea: "",
    active: true,
    currentScholars: 0,
    quota,
    vacancy: quota,
    june2026Allotment: 0,
    balance: quota,
    campus: "",
    phone: "",
    email: "",
    onVacancyList: false,
  };
}

export function SupervisorRegister({
  applications,
}: {
  applications: StoredApplication[];
}) {
  const [rows, setRows] = useState(applications);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [decision, setDecision] = useState<{
    id: string;
    status: "Approved" | "Rejected";
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const allocations = office?.allocations ?? [];
  const recognised = quotas
    .filter(
      (entry) =>
        !researchRegister.supervisors.some((item) => sameGuide(item.name, entry.name)),
    )
    .map((entry) =>
      recognisedGuide(entry.name, entry.department, entry.designation, entry.quota),
    );
  const directory = [...researchRegister.supervisors, ...recognised];

  const supervisors = directory.filter(
    (supervisor) =>
      (department === "" || supervisor.department === department) &&
      textMatches(query, [
        supervisor.name,
        supervisor.department,
        supervisor.designation,
        supervisor.researchArea,
        supervisor.supervisorId,
        supervisor.campus,
        supervisor.phone,
        supervisor.email,
      ]),
  );
  const waiting = rows.filter(
    (row) => row.status !== "Approved" && row.status !== "Rejected",
  );
  const decided = rows.filter(
    (row) => row.status === "Approved" || row.status === "Rejected",
  );

  async function saveDecision(remarks: string, quotaText: string) {
    if (!decision) return;
    const row = rows.find((item) => item.id === decision.id);
    if (!row) return;
    const approvedQuota = decision.status === "Approved" ? Number(quotaText) : undefined;
    setBusy(true);
    setNotice(null);
    const saved = await decideSupervisorApplication(
      row.id,
      row.payload,
      decision.status,
      remarks,
      approvedQuota,
    );
    if (saved && approvedQuota !== undefined) {
      const stored = await saveApprovedQuota({
        name: row.applicantName,
        quota: approvedQuota,
        department:
          payloadText(row.payload, "proposedDepartment") ||
          payloadText(row.payload, "department"),
        designation: payloadText(row.payload, "designation"),
      });
      if (!stored.ok) {
        setBusy(false);
        setNotice("The decision was saved, but the approved quota could not be stored.");
        return;
      }
    }
    setBusy(false);
    if (!saved) {
      setNotice("That decision could not be saved.");
      return;
    }
    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              status: decision.status,
              payload:
                item.payload &&
                typeof item.payload === "object" &&
                !Array.isArray(item.payload)
                  ? {
                      ...item.payload,
                      officeDecision: decision.status,
                      officeRemarks: remarks.trim(),
                      ...(approvedQuota !== undefined ? { approvedQuota } : {}),
                    }
                  : item.payload,
            }
          : item,
      ),
    );
    setNotice(
      decision.status === "Approved"
        ? `${row.applicantName} is approved with a quota of ${approvedQuota}.`
        : `${row.applicantName} is not approved.`,
    );
    setDecision(null);
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Supervisor register</h1>
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      <h2 className="mt-8 font-heading text-2xl text-primary">
        Recognition applications
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {waiting.length} waiting for a decision. {decided.length} already decided.
      </p>
      {waiting.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No recognition application is waiting.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {waiting.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-primary">{row.applicantName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.applicationNo}
                    {payloadText(row.payload, "designation")
                      ? ` · ${payloadText(row.payload, "designation")}`
                      : ""}
                    {payloadText(row.payload, "department")
                      ? ` · ${payloadText(row.payload, "department")}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.email}</p>
                  <p className="mt-1 text-sm">Status: {row.status}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="gold"
                    onClick={() => setDecision({ id: row.id, status: "Approved" })}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="maroon"
                    onClick={() => setDecision({ id: row.id, status: "Rejected" })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
              {decision?.id === row.id ? (
                <DecisionForm
                  key={`${row.id}-${decision.status}`}
                  status={decision.status}
                  busy={busy}
                  onCancel={() => setDecision(null)}
                  onSave={(remarks, quota) => void saveDecision(remarks, quota)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                <th className="px-3 py-3 font-semibold">Applicant</th>
                <th className="px-3 py-3 font-semibold">Department</th>
                <th className="px-3 py-3 font-semibold">Decision</th>
                <th className="px-3 py-3 font-semibold">Approved quota</th>
                <th className="px-3 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <p className="font-medium text-primary">{row.applicantName}</p>
                    <p className="text-muted-foreground">{row.applicationNo}</p>
                  </td>
                  <td className="px-3 py-3">
                    {payloadText(row.payload, "proposedDepartment") ||
                      payloadText(row.payload, "department") ||
                      "—"}
                  </td>
                  <td className="px-3 py-3">{row.status}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {payloadNumber(row.payload, "approvedQuota") ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {payloadText(row.payload, "officeRemarks") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <h2 className="mt-10 font-heading text-2xl text-primary">Supervisors</h2>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "department",
            label: "Department",
            value: department,
            options: [
              ...new Set(researchRegister.supervisors.map((item) => item.department)),
            ]
              .filter(Boolean)
              .sort((left, right) => left.localeCompare(right))
              .map((value) => ({ value, label: value })),
            onChange: setDepartment,
          },
        ]}
        shown={supervisors.length}
        total={directory.length}
        filename="supervisor-register.csv"
        downloadLabel="Download filtered supervisors"
        headers={[
          "S. No.",
          "Guide",
          "Supervisor ID",
          "Department",
          "Designation",
          "Area of research",
          "Active",
          "Quota",
          "Vacancy",
          "Campus",
          "Phone",
          "Mail ID",
        ]}
        rows={supervisors.map((supervisor) => {
          const figures = guideFigures(supervisor, quotas, allocations);
          return [
            supervisor.serialNo ? String(supervisor.serialNo) : "",
            supervisor.name,
            supervisor.supervisorId,
            supervisor.department,
            supervisor.designation,
            supervisor.researchArea,
            supervisor.active ? "Yes" : "No",
            String(figures.quota),
            String(figures.vacancy),
            supervisor.campus,
            supervisor.phone,
            supervisor.email,
          ];
        })}
      />

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[88rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              {[
                "S. No.",
                "Guide name",
                "Supervisor ID",
                "Department",
                "Designation",
                "Area of research",
                "Active",
                "Quota",
                "Vacancy",
                "June 2026 allotment",
                "Balance",
                "Campus",
                "Phone",
                "Mail ID",
              ].map((heading) => (
                <th key={heading} className="px-3 py-3 font-semibold whitespace-nowrap">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {supervisors.map((supervisor) => {
              const figures = guideFigures(supervisor, quotas, allocations);
              return (
                <tr
                  key={`${supervisor.serialNo}-${supervisor.name}`}
                  className="border-t border-border"
                >
                  <td className="px-3 py-3">{supervisor.serialNo || "—"}</td>
                  <td className="px-3 py-3">
                    <Link
                      href="/supervisor/dashboard"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() =>
                        openOfficeView({
                          role: "supervisor",
                          name: supervisor.name,
                          identifier:
                            supervisor.email.trim() ||
                            supervisor.supervisorId.trim() ||
                            supervisor.name,
                        })
                      }
                    >
                      {supervisor.name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{supervisor.supervisorId.trim() || "—"}</td>
                  <td className="px-3 py-3">{supervisor.department.trim() || "—"}</td>
                  <td className="px-3 py-3">{supervisor.designation.trim() || "—"}</td>
                  <td className="px-3 py-3">{supervisor.researchArea.trim() || "—"}</td>
                  <td className="px-3 py-3">{supervisor.active ? "Yes" : "No"}</td>
                  <td className="px-3 py-3 tabular-nums">{figures.quota}</td>
                  <td className="px-3 py-3 tabular-nums">{figures.vacancy}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {supervisor.june2026Allotment}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{figures.balance}</td>
                  <td className="px-3 py-3">{supervisor.campus.trim() || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {supervisor.phone.trim() || "—"}
                  </td>
                  <td className="px-3 py-3 break-all">
                    {supervisor.email.trim() || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionForm({
  status,
  busy,
  onCancel,
  onSave,
}: {
  status: "Approved" | "Rejected";
  busy: boolean;
  onCancel: () => void;
  onSave: (remarks: string, quota: string) => void;
}) {
  const schema = useMemo(() => decisionSchema(status), [status]);
  const form = useForm<DecisionValues>({
    resolver: zodResolver(schema),
    defaultValues: { remarks: "", quota: "" },
  });

  return (
    <form
      className="mt-4 grid gap-3 border-t border-border pt-4"
      onSubmit={form.handleSubmit((values) => onSave(values.remarks, values.quota))}
      noValidate
    >
      {status === "Approved" ? (
        <FormField
          label="Approved quota"
          htmlFor="approved-quota"
          required
          error={form.formState.errors.quota?.message}
        >
          <Input
            id="approved-quota"
            type="number"
            min={0}
            max={30}
            inputMode="numeric"
            {...form.register("quota")}
          />
        </FormField>
      ) : null}
      <FormField
        label={status === "Rejected" ? "Reason" : "Remarks"}
        htmlFor={`remarks-${status}`}
        required={status === "Rejected"}
        error={form.formState.errors.remarks?.message}
      >
        <textarea
          id={`remarks-${status}`}
          className="min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
          {...form.register("remarks")}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" variant="gold" disabled={busy}>
          {status === "Approved" ? "Confirm approval" : "Confirm rejection"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
