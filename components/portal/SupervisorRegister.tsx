"use client";

import { useState } from "react";
import { useSyncExternalStore } from "react";

import {
  ApplicationViewer,
  type ReviewAction,
} from "@/components/portal/ApplicationViewer";
import { DeskTabs, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { applicationReviewCopy, supervisorOfficeCopy } from "@/data/application-review";
import { personFileCopy } from "@/data/person-file";
import { researchRegister, type ResearchSupervisor } from "@/data/research-register";
import { currentOffice, subscribeOffice } from "@/lib/office";
import {
  downloadAllSupervisorDetails,
  matchSupervisorApplication,
  supervisorApplicationCells,
  supervisorWideHeaders,
} from "@/lib/person-file";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { usePreviewSession } from "@/lib/use-preview-session";
import { SupervisorRegisterEditor } from "@/components/portal/RegisterEditors";
import {
  currentQuotas,
  currentStandings,
  sameGuide,
  saveApprovedQuota,
  saveSupervisorStanding,
  subscribeRegister,
  supervisorDownloadRow,
  supervisorListingActive,
} from "@/lib/register";
import {
  isStoredApplication,
  reviewSupervisorApplication,
  updateApplicationDetails,
  type StoredApplication,
} from "@/lib/records";
import type { Json } from "@/types/database";
import { proposedQuota } from "@/lib/supervisor-approval";
import { SupervisorList } from "@/components/portal/SupervisorList";
import { RegisterImport } from "@/components/portal/RegisterImport";

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

function supervisorSignInId(supervisor: ResearchSupervisor) {
  return supervisor.email.trim() || supervisor.supervisorId.trim() || supervisor.name;
}

function supervisorApplicationFile(
  supervisor: ResearchSupervisor,
  applications: readonly StoredApplication[],
): StoredApplication {
  const identifier = supervisorSignInId(supervisor);
  const found = matchSupervisorApplication(identifier, supervisor.name, applications);
  if (found) return found;
  return {
    id: `register:${supervisor.serialNo}-${supervisor.name}`,
    kind: "supervisor",
    applicationNo: supervisor.supervisorId.trim() || supervisor.name,
    applicantName: supervisor.name,
    email: supervisor.email,
    dateOfBirth: "",
    studyMode: null,
    status: "Approved",
    createdAt: "",
    payload: {
      name: supervisor.name,
      email: supervisor.email,
      phone: supervisor.phone,
      designation: supervisor.designation,
      department: supervisor.department,
      proposedDepartment: supervisor.department,
      expertise: supervisor.researchArea,
    },
  };
}

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
  const [listTab, setListTab] = useState("active");
  const [viewing, setViewing] = useState<{
    application: StoredApplication;
    personId: string;
    review: boolean;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ResearchSupervisor | null>(null);
  const canExport = useCanMenuAction("export");
  const session = usePreviewSession();
  const canEdit = session?.role === "admin" || session?.role === "staff";
  const [saving, setSaving] = useState(false);
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const standings = useSyncExternalStore(
    subscribeRegister,
    currentStandings,
    currentStandings,
  );
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
      filterMatches(department, supervisor.department) &&
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
  const activeList = supervisors.filter((item) =>
    supervisorListingActive(item, standings),
  );
  const inactiveList = supervisors.filter(
    (item) => !supervisorListingActive(item, standings),
  );
  const shownList = listTab === "inactive" ? inactiveList : activeList;
  const waiting = rows.filter(
    (row) => row.status !== "Approved" && row.status !== "Rejected",
  );
  const pendingApproval = waiting.filter((row) => row.status === "Accepted");
  const decided = rows.filter(
    (row) => row.status === "Approved" || row.status === "Rejected",
  );

  async function reviewAction(
    application: StoredApplication,
    action: ReviewAction,
    remarks: string,
  ) {
    const approvedQuota =
      action === "Approved"
        ? proposedQuota(payloadText(application.payload, "designation"))
        : undefined;
    setBusy(true);
    setNotice(null);
    const saved = await reviewSupervisorApplication(
      application.id,
      application.payload,
      action,
      remarks,
      approvedQuota,
    );
    const row = application;
    const decision = { status: action };
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
      action === "Approved"
        ? applicationReviewCopy.approved
        : action === "Accepted"
          ? applicationReviewCopy.sentForApproval
          : applicationReviewCopy.rejected,
    );
    setViewing(null);
  }

  async function saveViewedApplication(next: {
    applicantName: string;
    email: string;
    payload: StoredApplication["payload"];
  }) {
    if (!viewing || !isStoredApplication(viewing.application.id)) return;
    setSaving(true);
    const saved = await updateApplicationDetails(
      viewing.application.kind,
      viewing.application.id,
      next,
    );
    setSaving(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setRows((current) =>
      current.map((item) =>
        item.id === viewing.application.id
          ? {
              ...item,
              applicantName: next.applicantName,
              email: next.email,
              payload: next.payload,
            }
          : item,
      ),
    );
    setViewing({
      ...viewing,
      application: {
        ...viewing.application,
        applicantName: next.applicantName,
        email: next.email,
        payload: next.payload,
      },
    });
    setNotice(applicationReviewCopy.saved);
  }

  return (
    <div>
      <PageTitle kicker="Administration" title="Supervisor register" />
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      <RegisterImport kind="supervisors" onDone={setNotice} />

      <div className="mt-6">
        <DeskTabs
          tabs={[
            { id: "active", label: supervisorOfficeCopy.activeTab },
            { id: "inactive", label: supervisorOfficeCopy.inactiveTab },
          ]}
          value={listTab}
          onChange={setListTab}
        />
      </div>

      <h2 className="mt-8 font-heading text-2xl text-primary">
        {supervisorOfficeCopy.recognition}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {waiting.length} {supervisorOfficeCopy.waiting}. {pendingApproval.length}{" "}
        {supervisorOfficeCopy.pendingApproval}. {decided.length} already decided.
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
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setViewing({
                      application: row,
                      personId: row.email.trim() || row.applicationNo,
                      review: true,
                    })
                  }
                >
                  {applicationReviewCopy.view}
                </Button>
              </div>
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
                <th className="px-3 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
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
                  <td className="px-3 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setViewing({
                          application: row,
                          personId: row.email.trim() || row.applicationNo,
                          review: row.status !== "Approved" && row.status !== "Rejected",
                        })
                      }
                    >
                      {applicationReviewCopy.view}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canExport ? (
        <>
          <h2 className="mt-10 font-heading text-2xl text-primary">Downloads</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadAllSupervisorDetails()}
            >
              {personFileCopy.downloadAllSupervisors}
            </Button>
          </div>
        </>
      ) : null}

      <h2 className="mt-10 font-heading text-2xl text-primary">
        {listTab === "inactive"
          ? supervisorOfficeCopy.inactiveTab
          : supervisorOfficeCopy.activeTab}
      </h2>
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
        shown={shownList.length}
        total={listTab === "inactive" ? inactiveList.length : activeList.length}
        filename="supervisor-register.csv"
        downloadLabel="Download filtered supervisors"
        headers={supervisorWideHeaders()}
        rows={shownList.map((supervisor) => [
          ...supervisorDownloadRow(supervisor, quotas, allocations),
          ...supervisorApplicationCells(
            supervisor.email.trim() || supervisor.supervisorId.trim() || supervisor.name,
            supervisor.name,
            rows,
          ),
        ])}
      />

      <SupervisorList
        supervisors={shownList}
        inactiveTab={listTab === "inactive"}
        quotas={quotas}
        allocations={allocations}
        standings={standings}
        busy={busy}
        canEditRow={() => canEdit}
        onView={(supervisor) =>
          setViewing({
            application: supervisorApplicationFile(supervisor, rows),
            personId: supervisorSignInId(supervisor),
            review: false,
          })
        }
        onEdit={(supervisor) => {
          setNotice(null);
          setEditing(supervisor);
        }}
        onMarkInactive={(supervisor) =>
          void saveSupervisorStanding(supervisor, false, "Inactive").then((saved) =>
            setNotice(saved.ok ? `${supervisor.name} is inactive.` : saved.message),
          )
        }
        onRestore={(supervisor) =>
          void saveSupervisorStanding(supervisor, true, null).then((saved) =>
            setNotice(
              saved.ok ? `${supervisor.name} is on the active list.` : saved.message,
            ),
          )
        }
      />
      {editing ? (
        <SupervisorRegisterEditor
          key={editing.serialNo}
          supervisor={editing}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      ) : null}
      {viewing ? (
        <ApplicationViewer
          application={viewing.application}
          personId={viewing.personId}
          editable={viewing.application.status === "Approved"}
          saving={saving}
          onClose={() => setViewing(null)}
          onSave={
            viewing.application.status === "Approved"
              ? (next) => void saveViewedApplication(next)
              : undefined
          }
          review={
            viewing.review
              ? {
                  busy,
                  onAction: (action, remarks) =>
                    void reviewAction(viewing.application, action, remarks),
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
