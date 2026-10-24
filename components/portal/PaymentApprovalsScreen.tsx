"use client";

import { useState, useSyncExternalStore } from "react";

import {
  DeskPage,
  DeskSection,
  DeskTable,
  DeskTabs,
  StatusPill,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { filterMatches, ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import {
  paymentCopy,
  paymentKinds,
  type FeeStatus,
  type PaymentKindId,
} from "@/data/payments";
import {
  currentAdmission,
  displayName,
  setApplicationFee,
  subscribeAdmission,
  type PaymentMark,
} from "@/lib/admission";
import {
  currentDoctoral,
  setCourseWorkPayment,
  subscribeDoctoral,
  type CourseRegistration,
} from "@/lib/doctoral";
import {
  currentScholarRecords,
  loadRecordFile,
  setScholarRecordStatus,
  subscribeScholarRecords,
} from "@/lib/scholar-records";
import { rupees, useFees } from "@/lib/fee-settings";
import { formatInr } from "@/lib/utils";

function courseGroups(rows: readonly CourseRegistration[]) {
  const map = new Map<string, CourseRegistration[]>();
  for (const row of rows) {
    const key = [
      row.scholarIdentifier.toLowerCase(),
      row.paymentDate,
      row.paymentReference,
      String(row.semester),
    ].join("|");
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.values()].map((papers) => {
    const first = papers[0];
    const amount = papers.reduce((sum, item) => sum + (item.amount || 0), 0);
    return {
      id: first?.id ?? "",
      ids: papers.map((item) => item.id),
      scholarName: first?.scholarName ?? "",
      scholarIdentifier: first?.scholarIdentifier ?? "",
      semester: first?.semester ?? 0,
      paymentDate: first?.paymentDate ?? "",
      paymentReference: first?.paymentReference ?? "",
      paymentMode: first?.paymentMode ?? "",
      receiptName: first?.receiptName ?? null,
      receiptData: first?.receiptData ?? null,
      amount,
      status: first?.paymentStatus ?? "Pending",
      papers: papers
        .map((item) => item.code || item.name)
        .filter(Boolean)
        .join(", "),
    };
  });
}

export function PaymentApprovalsScreen() {
  const fees = useFees();
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const annual = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const [tab, setTab] = useState<PaymentKindId>("application");
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  async function markApplication(id: string, payment: PaymentMark) {
    setBusyId(id);
    const saved = await setApplicationFee(id, payment);
    setBusyId(null);
    setNotice(saved.ok ? `Application fee ${payment}.` : saved.message);
  }

  async function markCourse(ids: readonly string[], status: FeeStatus) {
    setBusyId(ids[0] ?? "course");
    const saved = await setCourseWorkPayment(ids, status);
    setBusyId(null);
    setNotice(saved.ok ? `Course-work fee ${status}.` : saved.message);
  }

  async function markAnnual(id: string, status: "Approved" | "Returned") {
    const record = annual?.records.find((item) => item.id === id);
    if (!record) return;
    setBusyId(id);
    const saved = await setScholarRecordStatus(
      record,
      status,
      status === "Returned" ? "Returned by the research office." : "",
    );
    setBusyId(null);
    setNotice(
      saved ? `Annual research fee ${status}.` : "That payment could not be updated.",
    );
  }

  const allApplications = admission?.cases ?? [];
  const allCourses = doctoral ? courseGroups(doctoral.registrations) : [];
  const allAnnual = annual?.records ?? [];
  const applications = allApplications.filter(
    (row) =>
      filterMatches(statusFilter, row.payment) &&
      filterMatches(groupFilter, row.department) &&
      textMatches(query, [displayName(row), row.applicationNo, row.department]),
  );
  const courses = allCourses.filter(
    (row) =>
      filterMatches(statusFilter, row.status) &&
      filterMatches(groupFilter, `Semester ${row.semester}`) &&
      textMatches(query, [row.scholarName, row.papers, row.paymentReference]),
  );
  const annualRows = allAnnual.filter(
    (row) =>
      filterMatches(statusFilter, row.status) &&
      textMatches(query, [
        row.scholarName,
        row.scholarIdentifier,
        row.payload.purpose ?? "",
      ]),
  );
  const statusOptions = [
    ...new Set(
      tab === "application"
        ? allApplications.map((row) => row.payment)
        : tab === "course-work"
          ? allCourses.map((row) => row.status)
          : allAnnual.map((row) => row.status),
    ),
  ]
    .filter(Boolean)
    .sort()
    .map((value) => ({ value, label: value }));
  const groupOptions = [
    ...new Set(
      tab === "application"
        ? allApplications.map((row) => row.department)
        : allCourses.map((row) => `Semester ${row.semester}`),
    ),
  ]
    .filter(Boolean)
    .sort()
    .map((value) => ({ value, label: value }));
  const exportTable =
    tab === "application"
      ? {
          title: "Application fee",
          headers: ["Applicant", "Application No.", "Department", "Amount", "Status"],
          rows: applications.map((row) => [
            displayName(row),
            row.applicationNo,
            row.department,
            rupees(fees.application),
            row.payment,
          ]),
          total: allApplications.length,
        }
      : tab === "course-work"
        ? {
            title: "Course-work fee",
            headers: [
              "Scholar",
              "Semester",
              "Papers",
              "Amount",
              "Paid on",
              "Reference",
              "Status",
            ],
            rows: courses.map((row) => [
              row.scholarName,
              String(row.semester),
              row.papers,
              formatInr(row.amount),
              row.paymentDate,
              row.paymentReference,
              row.status,
            ]),
            total: allCourses.length,
          }
        : {
            title: "Annual research fee",
            headers: ["Scholar", "Sign-in", "Amount", "Purpose", "Paid on", "Status"],
            rows: annualRows.map((row) => [
              row.scholarName,
              row.scholarIdentifier,
              row.payload.amount ?? "",
              row.payload.purpose ?? "",
              row.payload.paidOn ?? "",
              row.status,
            ]),
            total: allAnnual.length,
          };

  return (
    <DeskPage kicker={paymentCopy.kicker} title={paymentCopy.title}>
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskTabs
        tabs={paymentKinds.map((item) => ({ id: item.id, label: item.label }))}
        value={tab}
        onChange={(id) => {
          setTab(id as PaymentKindId);
          setStatusFilter("");
          setGroupFilter("");
        }}
      />
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "status",
            label: "Status",
            value: statusFilter,
            options: statusOptions,
            onChange: setStatusFilter,
          },
          ...(tab === "annual"
            ? []
            : [
                {
                  id: "group",
                  label: tab === "application" ? "Department" : "Semester",
                  value: groupFilter,
                  options: groupOptions,
                  onChange: setGroupFilter,
                },
              ]),
        ]}
        shown={exportTable.rows.length}
        total={exportTable.total}
        filename={`payments-${tab}.csv`}
        title={`Payment approvals · ${exportTable.title}`}
        headers={exportTable.headers}
        rows={exportTable.rows}
      />
      {tab === "application" ? (
        <DeskSection title="Application fee">
          <DeskTable
            headers={["Applicant", "Department", "Amount", "Status", ""]}
            empty={applications.length === 0}
          >
            {applications.map((row) => (
              <tr key={row.applicationId} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-primary">{displayName(row)}</p>
                  <p className="text-muted-foreground">{row.applicationNo}</p>
                </td>
                <td className="px-4 py-3">{row.department}</td>
                <td className="px-4 py-3">{rupees(fees.application)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={row.payment} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      disabled={
                        busyId === row.applicationId || row.payment === "Approved"
                      }
                      onClick={() => void markApplication(row.applicationId, "Approved")}
                    >
                      {paymentCopy.approve}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="maroon"
                      disabled={
                        busyId === row.applicationId || row.payment === "Returned"
                      }
                      onClick={() => void markApplication(row.applicationId, "Returned")}
                    >
                      {paymentCopy.return}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : null}
      {tab === "course-work" ? (
        <DeskSection title="Course-work fee">
          <DeskTable
            headers={["Scholar", "Papers", "Amount", "Receipt", "Status", ""]}
            empty={courses.length === 0}
          >
            {courses.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-primary">{row.scholarName}</p>
                  <p className="text-muted-foreground">
                    Semester {row.semester}
                    {row.paymentDate ? ` · ${row.paymentDate}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3">{row.papers || "—"}</td>
                <td className="px-4 py-3">₹{formatInr(row.amount)}</td>
                <td className="px-4 py-3">
                  <ViewFilesButton fileName={row.receiptName} data={row.receiptData} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      disabled={busyId === row.id || row.status === "Approved"}
                      onClick={() => void markCourse(row.ids, "Approved")}
                    >
                      {paymentCopy.approve}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="maroon"
                      disabled={busyId === row.id || row.status === "Returned"}
                      onClick={() => void markCourse(row.ids, "Returned")}
                    >
                      {paymentCopy.return}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : null}
      {tab === "annual" ? (
        <DeskSection title="Annual research fee">
          <DeskTable
            headers={["Scholar", "Details", "Receipt", "Status", ""]}
            empty={annualRows.length === 0}
          >
            {annualRows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-primary">{row.scholarName}</p>
                  <p className="text-muted-foreground">{row.scholarIdentifier}</p>
                </td>
                <td className="px-4 py-3">
                  <p>₹{row.payload.amount || "—"}</p>
                  <p className="text-muted-foreground">
                    {row.payload.purpose || "Annual research fee"}
                    {row.payload.paidOn ? ` · ${row.payload.paidOn}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <ViewFilesButton
                    fileName={row.fileName}
                    load={() => loadRecordFile(row)}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="gold"
                      disabled={busyId === row.id || row.status === "Approved"}
                      onClick={() => void markAnnual(row.id, "Approved")}
                    >
                      {paymentCopy.approve}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="maroon"
                      disabled={busyId === row.id || row.status === "Returned"}
                      onClick={() => void markAnnual(row.id, "Returned")}
                    >
                      {paymentCopy.return}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : null}
    </DeskPage>
  );
}
