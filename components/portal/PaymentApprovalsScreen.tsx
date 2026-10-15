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
import { Button } from "@/components/ui/button";
import { applicationFee } from "@/data/fees";
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

  const applications = admission?.cases ?? [];
  const courses = doctoral ? courseGroups(doctoral.registrations) : [];
  const annualRows = annual?.records ?? [];

  return (
    <DeskPage kicker={paymentCopy.kicker} title={paymentCopy.title}>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {paymentCopy.detail}
      </p>
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <DeskTabs
        tabs={paymentKinds.map((item) => ({ id: item.id, label: item.label }))}
        value={tab}
        onChange={(id) => setTab(id as PaymentKindId)}
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
                <td className="px-4 py-3">{applicationFee.amount}</td>
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
