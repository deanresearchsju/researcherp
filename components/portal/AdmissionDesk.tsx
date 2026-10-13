"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import {
  AdmissionLetter,
  AttendanceSheet,
  ProvisionalSheet,
} from "@/components/portal/AdmissionPrint";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { useClientReady } from "@/components/forms/ClientGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  admissionChecklist,
  defaultLetter,
  interviewMax,
  writtenMax,
} from "@/data/admission";
import {
  applyVacancySelection,
  attendanceOrder,
  currentAdmission,
  displayName,
  marksError,
  mergeApplications,
  missingItems,
  paymentMarks,
  provisionalOrder,
  saveAdmission,
  seatsFor,
  sameSubject,
  subscribeAdmission,
  totalMarks,
  verificationBlock,
  type AdmissionCase,
  type AttendanceMark,
  type CheckMark,
  type LetterConfig,
  type PaymentMark,
} from "@/lib/admission";
import {
  currentOffice,
  removeAllocation,
  sameId,
  saveAllocation,
  subscribeOffice,
} from "@/lib/office";
import { updateApplicationStatus, type StoredApplication } from "@/lib/records";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import type { Vacancy } from "@/lib/vacancies";

const steps = [
  ["applications", "1. Applications"],
  ["payment", "2. Payment"],
  ["shortlist", "3. Shortlist"],
  ["entrance", "4. Entrance"],
  ["marks", "5. Marks"],
  ["selection", "6. Selection"],
  ["provisional", "7. Provisional list"],
  ["letter", "8. Letter"],
  ["fees", "9. Fee receipt"],
  ["certificates", "10. Certificates"],
] as const;

type Step = (typeof steps)[number][0];

type Sheet =
  | null
  | { kind: "attendance" }
  | { kind: "provisional" }
  | { kind: "letter"; applicationId: string };

const letterSchema = z.object({
  programme: z.string().min(1, "Enter the programme name.").max(120),
  sessionLabel: z.string().min(1, "Enter the letter heading.").max(160),
  refPrefix: z.string().min(1, "Enter the reference prefix.").max(80),
  issueDate: z.string().min(1, "Enter the letter date.").max(40),
  reportBy: z.string().min(1, "Enter the reporting date.").max(80),
  fullTimeFee: z.string().regex(/^\d+$/, "Enter the full-time fee in rupees."),
  partTimeFee: z.string().regex(/^\d+$/, "Enter the part-time fee in rupees."),
  accountName: z.string().min(1, "Enter the account name.").max(120),
  accountNumber: z.string().min(1, "Enter the account number.").max(40),
  bankName: z.string().min(1, "Enter the bank.").max(120),
  ifsc: z.string().min(1, "Enter the IFSC.").max(20),
  branch: z.string().min(1, "Enter the branch.").max(80),
  deanName: z.string().min(1, "Enter the signatory.").max(120),
  deanTitle: z.string().min(1, "Enter the designation.").max(160),
  phone: z.string().min(1, "Enter the phone number.").max(40),
  documents: z.string().min(1, "Enter the documents, one on each line."),
});

function cleared(row: AdmissionCase, keepShortlist: boolean): AdmissionCase {
  const shortlisted = keepShortlist && row.payment === "Approved";
  const attendance: AttendanceMark = shortlisted ? row.attendance : "";
  const present = attendance === "Present";
  const selected =
    present && row.written !== null && row.interview !== null && row.selected;
  return {
    ...row,
    shortlisted,
    attendance,
    written: present ? row.written : null,
    interview: present ? row.interview : null,
    selected,
    guideName: selected ? row.guideName : "",
    guideIdentifier: selected ? row.guideIdentifier : "",
    verification: selected ? row.verification : "Pending",
  };
}

export function AdmissionDesk({
  applications,
  vacancies,
}: {
  applications: StoredApplication[];
  vacancies: Vacancy[];
}) {
  const ready = useClientReady();
  const store = useSyncExternalStore(subscribeAdmission, currentAdmission, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const form = useForm<LetterConfig>({
    resolver: zodResolver(letterSchema) as Resolver<LetterConfig>,
    values: store?.letter ?? defaultLetter,
  });
  const [step, setStep] = useState<Step>("applications");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [payment, setPayment] = useState("");
  const [attendance, setAttendance] = useState("");
  const [notice, setNotice] = useState("");

  function linkedScholar(row: AdmissionCase) {
    const accounts = (users?.users ?? []).filter((item) => item.role === "scholar");
    const match =
      accounts.find((item) => sameId(item.identifier, row.email)) ??
      accounts.find((item) => sameId(item.identifier, row.applicationNo)) ??
      accounts.find((item) => sameId(item.name, row.name));
    return match?.identifier ?? row.email;
  }

  if (!ready || !store) {
    return <p className="text-sm text-muted-foreground">Loading the admission file…</p>;
  }

  const cases = mergeApplications(store.cases, applications);
  const departments = [...new Set(cases.map((row) => row.department))].sort((a, b) =>
    a.localeCompare(b),
  );
  const subjects = [...new Set(vacancies.map((item) => item.department))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visible = cases.filter(
    (row) =>
      textMatches(query, [
        row.name,
        row.applicationNo,
        row.email,
        row.department,
        row.guideName,
      ]) &&
      (!department || row.department === department) &&
      (!payment || row.payment === payment) &&
      (!attendance || row.attendance === attendance),
  );

  async function commit(
    nextCases: AdmissionCase[],
    letter = store?.letter ?? defaultLetter,
  ) {
    const saved = await saveAdmission({ cases: nextCases, letter });
    setNotice(saved.ok ? "" : saved.message);
    return saved.ok;
  }

  async function commitRow(id: string, patch: Partial<AdmissionCase>) {
    const current = cases.find((row) => row.applicationId === id);
    if (!current) return;
    let nextRow: AdmissionCase = { ...current, ...patch };
    const dropped =
      current.verification === "Approved" &&
      (nextRow.verification !== "Approved" || verificationBlock(nextRow) !== null);
    if (dropped) {
      nextRow = { ...nextRow, verification: "Pending" };
      const allocation = currentOffice()?.allocations.find((item) =>
        sameId(item.scholarIdentifier, linkedScholar(current)),
      );
      if (allocation) await removeAllocation(allocation);
    }
    const nextCases = cases.map((row) => (row.applicationId === id ? nextRow : row));
    const ok = await commit(nextCases);
    if (ok && nextRow.verification === "Approved") {
      const allotted = await saveAllocation({
        scholarIdentifier: linkedScholar(nextRow),
        scholarName: nextRow.name,
        supervisorIdentifier: nextRow.guideIdentifier || nextRow.guideName,
        supervisorName: nextRow.guideName,
      });
      if (!allotted.ok) setNotice(allotted.message);
    }
  }

  async function persistCases(nextCases: AdmissionCase[]) {
    for (const before of cases) {
      const after = nextCases.find((item) => item.applicationId === before.applicationId);
      if (!after) continue;
      if (before.verification === "Approved" && after.verification !== "Approved") {
        const allocation = currentOffice()?.allocations.find((item) =>
          sameId(item.scholarIdentifier, linkedScholar(before)),
        );
        if (allocation) await removeAllocation(allocation);
      }
      if (
        after.verification === "Approved" &&
        (before.guideIdentifier !== after.guideIdentifier ||
          before.verification !== "Approved")
      ) {
        const allotted = await saveAllocation({
          scholarIdentifier: linkedScholar(after),
          scholarName: after.name,
          supervisorIdentifier: after.guideIdentifier || after.guideName,
          supervisorName: after.guideName,
        });
        if (!allotted.ok) setNotice(allotted.message);
      }
    }
    return commit(nextCases);
  }

  async function saveLetter(letter: LetterConfig) {
    const ok = await commit(cases, letter);
    if (ok) setNotice("The provisional letter wording has been saved.");
  }

  const orderedAttendance = attendanceOrder(cases).map((row, index) => ({
    row,
    serial: index + 1,
  }));
  const orderedProvisional = provisionalOrder(cases).map((row, index) => ({
    row,
    serial: index + 1,
  }));

  if (sheet?.kind === "attendance") {
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSheet(null)}>
            Back to selection
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print attendance list
          </Button>
        </div>
        <AttendanceSheet rows={orderedAttendance} />
      </div>
    );
  }

  if (sheet?.kind === "provisional") {
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSheet(null)}>
            Back to selection
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print provisional list
          </Button>
        </div>
        <ProvisionalSheet rows={orderedProvisional} />
      </div>
    );
  }

  if (sheet?.kind === "letter") {
    const match = orderedProvisional.find(
      (item) => item.row.applicationId === sheet.applicationId,
    );
    return (
      <div>
        <div className="no-print mb-4 flex gap-2">
          <Button type="button" variant="outline" onClick={() => setSheet(null)}>
            Back to selection
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Print admission letter
          </Button>
        </div>
        {match ? (
          <AdmissionLetter row={match.row} serial={match.serial} letter={store.letter} />
        ) : (
          <p className="text-sm">This candidate is not on the provisional list.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Admissions
        </p>
        <h1 className="mt-1 font-serif text-3xl text-primary">Selection</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Received applications move through fee approval, a vacancy shortlist, the
          entrance list, marks out of {writtenMax + interviewMax}, and a provisional list.
          The allotted guide appears to the scholar and the supervisor only after
          certificate verification is approved.
        </p>
        {store.detail ? (
          <p className="mt-2 text-sm text-muted-foreground">{store.detail}</p>
        ) : null}
        {notice ? <p className="mt-2 text-sm text-secondary">{notice}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={step === id ? "default" : "outline"}
            onClick={() => setStep(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "department",
            label: "Department",
            value: department,
            options: departments.map((item) => ({ value: item, label: item })),
            onChange: setDepartment,
          },
          {
            id: "payment",
            label: "Payment",
            value: payment,
            options: paymentMarks.map((item) => ({ value: item, label: item })),
            onChange: setPayment,
          },
          {
            id: "attendance",
            label: "Attendance",
            value: attendance,
            options: [
              { value: "Present", label: "Present" },
              { value: "Absent", label: "Absent" },
            ],
            onChange: setAttendance,
          },
        ]}
        shown={visible.length}
        total={cases.length}
        filename="admission-selection.csv"
        headers={[
          "Application No.",
          "Name",
          "Department",
          "Payment",
          "Shortlisted",
          "Attendance",
          "Written",
          "Interview",
          "Total",
          "Selected",
          "Guide",
          "Certificates",
        ]}
        rows={visible.map((row) => [
          row.applicationNo,
          displayName(row),
          row.department,
          row.payment,
          row.shortlisted ? "Yes" : "No",
          row.attendance || "—",
          row.written === null ? "" : String(row.written),
          row.interview === null ? "" : String(row.interview),
          totalMarks(row) === null ? "" : String(totalMarks(row)),
          row.selected ? "Yes" : "No",
          row.guideName,
          row.verification,
        ])}
      />

      {step === "applications" ? (
        <Stage
          title="Applications received"
          text="These are the Ph.D. applications already stored by the office."
        >
          <Rows
            rows={visible}
            empty="No application matches these filters."
            render={(row) => (
              <>
                <td className="px-3 py-2">{row.applicationNo}</td>
                <td className="px-3 py-2">{displayName(row)}</td>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">{row.studyMode}</td>
                <td className="px-3 py-2">{row.email}</td>
              </>
            )}
            headers={["Application No.", "Name", "Department", "Mode", "Email"]}
          />
        </Stage>
      ) : null}

      {step === "payment" ? (
        <Stage
          title="Payment verification"
          text="Approve the application fee before a candidate can be shortlisted."
        >
          <Rows
            rows={visible}
            empty="No application matches these filters."
            headers={["Application No.", "Name", "Department", "Payment"]}
            render={(row) => (
              <>
                <td className="px-3 py-2">{row.applicationNo}</td>
                <td className="px-3 py-2">{displayName(row)}</td>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">
                  <NativeSelect
                    value={row.payment}
                    onChange={(event) => {
                      const next = event.target.value as PaymentMark;
                      const updated = cleared(
                        {
                          ...row,
                          payment: next,
                          shortlisted: next === "Approved" && row.shortlisted,
                        },
                        next === "Approved" && row.shortlisted,
                      );
                      void commitRow(row.applicationId, updated);
                      void updateApplicationStatus(
                        "phd",
                        row.applicationId,
                        next === "Approved" ? "Under review" : "Acknowledgement sent",
                      );
                    }}
                    aria-label={`Payment for ${row.name}`}
                  >
                    {paymentMarks.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </NativeSelect>
                </td>
              </>
            )}
          />
        </Stage>
      ) : null}

      {step === "shortlist" ? (
        <Stage
          title="Shortlist against vacancies"
          text="A candidate is eligible when the fee is approved and the subject still has a vacancy."
        >
          <Button
            type="button"
            className="mb-3"
            onClick={() => {
              const next = cases.map((row) => {
                const eligible =
                  row.payment === "Approved" && seatsFor(row.department, vacancies) > 0;
                return cleared({ ...row, shortlisted: eligible }, eligible);
              });
              void persistCases(next);
              next.forEach((row) => {
                void updateApplicationStatus(
                  "phd",
                  row.applicationId,
                  row.shortlisted ? "Shortlisted" : "Under review",
                );
              });
            }}
          >
            Shortlist every eligible candidate
          </Button>
          <Rows
            rows={visible}
            empty="No application matches these filters."
            headers={["Name", "Subject", "Seats", "Fee", "Shortlist"]}
            render={(row) => {
              const seats = seatsFor(row.department, vacancies);
              return (
                <>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">
                    <NativeSelect
                      value={row.department}
                      onChange={(event) => {
                        void commitRow(
                          row.applicationId,
                          cleared(
                            {
                              ...row,
                              department: event.target.value,
                              shortlisted: false,
                              attendance: "",
                              written: null,
                              interview: null,
                              selected: false,
                            },
                            false,
                          ),
                        );
                      }}
                      aria-label={`Subject for ${row.name}`}
                    >
                      {subjects.includes(row.department) ? null : (
                        <option value={row.department}>{row.department}</option>
                      )}
                      {subjects.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                  <td className="px-3 py-2">{seats}</td>
                  <td className="px-3 py-2">{row.payment}</td>
                  <td className="px-3 py-2">
                    {row.shortlisted ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void commitRow(
                            row.applicationId,
                            cleared({ ...row, shortlisted: false }, false),
                          );
                          void updateApplicationStatus(
                            "phd",
                            row.applicationId,
                            "Under review",
                          );
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={row.payment !== "Approved" || seats === 0}
                        onClick={() => {
                          void commitRow(
                            row.applicationId,
                            cleared({ ...row, shortlisted: true }, true),
                          );
                          void updateApplicationStatus(
                            "phd",
                            row.applicationId,
                            "Shortlisted",
                          );
                        }}
                      >
                        Shortlist
                      </Button>
                    )}
                  </td>
                </>
              );
            }}
          />
        </Stage>
      ) : null}

      {step === "entrance" ? (
        <Stage
          title="Entrance and interview"
          text="The attendance list is department-wise, with one continuous serial number. Mark who was present."
        >
          <Button
            type="button"
            className="mb-3"
            onClick={() => setSheet({ kind: "attendance" })}
          >
            Prepare attendance list
          </Button>
          <Rows
            rows={visible.filter((row) => row.shortlisted)}
            empty="Shortlist a candidate before marking attendance."
            headers={["S. No.", "Department", "Name", "Application No.", "Attendance"]}
            render={(row) => {
              const serial =
                orderedAttendance.find(
                  (item) => item.row.applicationId === row.applicationId,
                )?.serial ?? "—";
              return (
                <>
                  <td className="px-3 py-2">{serial}</td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.applicationNo}</td>
                  <td className="px-3 py-2">
                    <NativeSelect
                      value={row.attendance}
                      onChange={(event) => {
                        const next = event.target.value as AttendanceMark | "";
                        void commitRow(
                          row.applicationId,
                          cleared({ ...row, attendance: next === "" ? "" : next }, true),
                        );
                      }}
                      aria-label={`Attendance for ${row.name}`}
                    >
                      <option value="">Not marked</option>
                      <option value="Present">Present</option>
                      <option value="Absent">Absent</option>
                    </NativeSelect>
                  </td>
                </>
              );
            }}
          />
        </Stage>
      ) : null}

      {step === "marks" ? (
        <Stage
          title="Marks"
          text={`Written test ${writtenMax} and interview ${interviewMax}. Only candidates marked present can be given marks.`}
        >
          <Rows
            rows={visible.filter((row) => row.attendance === "Present")}
            empty="Mark a shortlisted candidate present before entering marks."
            headers={["Name", "Department", "Written", "Interview", "Total", ""]}
            render={(row) => (
              <MarksCells
                row={row}
                onSave={(written, interview) => {
                  const error = marksError(written, interview);
                  if (error) return error;
                  void commitRow(row.applicationId, {
                    written: Number(written),
                    interview: Number(interview),
                    selected: false,
                    guideName: "",
                    guideIdentifier: "",
                    verification: "Pending",
                  });
                  return null;
                }}
              />
            )}
          />
        </Stage>
      ) : null}

      {step === "selection" ? (
        <Stage
          title="Department-wise selection"
          text="Present candidates with marks are ranked in each department. The vacancy count decides how many are selected."
        >
          <Button
            type="button"
            className="mb-3"
            onClick={() => {
              const next = applyVacancySelection(cases, vacancies);
              void persistCases(next);
              next.forEach((row) => {
                if (row.attendance !== "Present" || totalMarks(row) === null) return;
                void updateApplicationStatus(
                  "phd",
                  row.applicationId,
                  row.selected ? "Selected" : "Not selected",
                );
              });
              setNotice("Selection now follows the vacancy count in each department.");
            }}
          >
            Select by vacancy
          </Button>
          <Rows
            rows={visible.filter(
              (row) => row.attendance === "Present" && totalMarks(row) !== null,
            )}
            empty="Enter marks for a present candidate before selection."
            headers={["Department", "Name", "Total", "Seats", "Selected"]}
            render={(row) => (
              <>
                <td className="px-3 py-2">{row.department}</td>
                <td className="px-3 py-2">{displayName(row)}</td>
                <td className="px-3 py-2">{totalMarks(row)}</td>
                <td className="px-3 py-2">{seatsFor(row.department, vacancies)}</td>
                <td className="px-3 py-2">
                  {row.selected ? "Selected" : "Not selected"}
                </td>
              </>
            )}
          />
        </Stage>
      ) : null}

      {step === "provisional" ? (
        <Stage
          title="Provisional list and guide"
          text="Allot the guide here. The guide does not see the scholar until certificate verification is approved."
        >
          <Button
            type="button"
            className="mb-3"
            onClick={() => setSheet({ kind: "provisional" })}
          >
            Prepare provisional list
          </Button>
          <Rows
            rows={visible.filter((row) => row.selected)}
            empty="Run the vacancy selection before allotting a guide."
            headers={[
              "S. No.",
              "Name of the Candidate",
              "Subject/department",
              "Guide Allotted",
            ]}
            render={(row) => {
              const serial =
                orderedProvisional.find(
                  (item) => item.row.applicationId === row.applicationId,
                )?.serial ?? "—";
              const choices = vacancies.filter((item) =>
                sameSubject(row.department, item.department),
              );
              const guideChoices = choices.length > 0 ? choices : vacancies;
              return (
                <>
                  <td className="px-3 py-2">{serial}</td>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">
                    <NativeSelect
                      value={
                        guideChoices.find((item) => item.supervisorName === row.guideName)
                          ?.id ?? ""
                      }
                      onChange={(event) => {
                        const vacancy = guideChoices.find(
                          (item) => item.id === event.target.value,
                        );
                        if (!vacancy) {
                          void commitRow(row.applicationId, {
                            guideName: "",
                            guideIdentifier: "",
                          });
                          return;
                        }
                        const used = cases.filter(
                          (item) =>
                            item.applicationId !== row.applicationId &&
                            item.guideName === vacancy.supervisorName,
                        ).length;
                        if (used >= vacancy.vacancyCount) {
                          setNotice(`${vacancy.supervisorName} has no vacancy left.`);
                          return;
                        }
                        const account = users?.users.find(
                          (item) =>
                            item.role === "supervisor" &&
                            item.name.toLowerCase() ===
                              vacancy.supervisorName.toLowerCase(),
                        );
                        void commitRow(row.applicationId, {
                          guideName: vacancy.supervisorName,
                          guideIdentifier: account?.identifier ?? vacancy.supervisorName,
                        });
                      }}
                      aria-label={`Guide for ${row.name}`}
                    >
                      <option value="">Choose a guide</option>
                      {guideChoices.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.supervisorName} · {item.department} · {item.vacancyCount}{" "}
                          seats
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </>
              );
            }}
          />
        </Stage>
      ) : null}

      {step === "letter" ? (
        <Stage
          title="Provisional admission letter"
          text="This wording is used for every selected candidate. The application number, name, department, mode, and reference are filled from the selection list."
        >
          <form
            className="mb-6 grid gap-3 sm:grid-cols-2"
            onSubmit={form.handleSubmit((values) => void saveLetter(values))}
          >
            {(
              [
                ["programme", "Programme"],
                ["sessionLabel", "Letter heading"],
                ["refPrefix", "Reference prefix"],
                ["issueDate", "Letter date"],
                ["reportBy", "Report by"],
                ["fullTimeFee", "Full-time fee (₹)"],
                ["partTimeFee", "Part-time fee (₹)"],
                ["accountName", "Account name"],
                ["accountNumber", "Account number"],
                ["bankName", "Bank"],
                ["ifsc", "IFSC"],
                ["branch", "Branch"],
                ["deanName", "Signatory"],
                ["deanTitle", "Designation"],
                ["phone", "Phone"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="mb-1 block font-semibold">{label}</span>
                <Input {...form.register(key)} />
                {form.formState.errors[key] ? (
                  <span className="mt-1 block text-secondary">
                    {form.formState.errors[key]?.message}
                  </span>
                ) : null}
              </label>
            ))}
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-semibold">
                Documents, one on each line
              </span>
              <textarea
                {...form.register("documents")}
                rows={8}
                className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
              />
              {form.formState.errors.documents ? (
                <span className="mt-1 block text-secondary">
                  {form.formState.errors.documents.message}
                </span>
              ) : null}
            </label>
            <Button type="submit" className="sm:col-span-2 sm:w-fit">
              Save letter wording
            </Button>
          </form>
          <Rows
            rows={visible.filter((row) => row.selected)}
            empty="Select a candidate before printing a letter."
            headers={["S. No.", "Name", "Application No.", "Letter"]}
            render={(row) => {
              const serial =
                orderedProvisional.find(
                  (item) => item.row.applicationId === row.applicationId,
                )?.serial ?? "—";
              return (
                <>
                  <td className="px-3 py-2">{serial}</td>
                  <td className="px-3 py-2">{displayName(row)}</td>
                  <td className="px-3 py-2">{row.applicationNo}</td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        setSheet({ kind: "letter", applicationId: row.applicationId })
                      }
                    >
                      Open letter
                    </Button>
                  </td>
                </>
              );
            }}
          />
        </Stage>
      ) : null}

      {step === "fees" ? (
        <Stage
          title="Tuition fee receipt"
          text="Selected scholars upload the payment reference and the receipt from their own admission file."
        >
          <Rows
            rows={visible.filter((row) => row.selected)}
            empty="No selected candidate matches these filters."
            headers={["Name", "Reference", "Amount", "Receipt"]}
            render={(row) => (
              <>
                <td className="px-3 py-2">{displayName(row)}</td>
                <td className="px-3 py-2">{row.feeReference || "Not uploaded"}</td>
                <td className="px-3 py-2">{row.feeAmount ? `₹${row.feeAmount}` : "—"}</td>
                <td className="px-3 py-2">
                  {row.feeReceiptData ? (
                    <a
                      className="font-semibold text-primary underline"
                      href={row.feeReceiptData}
                    >
                      {row.feeReceiptName}
                    </a>
                  ) : (
                    "Waiting for the scholar"
                  )}
                </td>
              </>
            )}
          />
        </Stage>
      ) : null}

      {step === "certificates" ? (
        <Stage
          title="Certificate verification"
          text="Mark each checklist line. Anything marked Missing stays on the scholar's admission file until they upload it. Approving this step shows the guide to the scholar and the new scholar to the supervisor."
        >
          <div className="space-y-4">
            {visible.filter((row) => row.selected).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No selected candidate matches these filters.
              </p>
            ) : null}
            {visible
              .filter((row) => row.selected)
              .map((row) => (
                <section
                  key={row.applicationId}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      {displayName(row)} · {row.department}
                    </h3>
                    <p className="text-sm">
                      {row.verification === "Approved" ? "Approved" : "Pending"}
                      {row.guideName ? ` · ${row.guideName}` : ""}
                    </p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {admissionChecklist.map((item) => {
                      const upload = row.uploads[item.id];
                      return (
                        <div
                          key={item.id}
                          className="grid gap-2 sm:grid-cols-[1fr_14rem] sm:items-center"
                        >
                          <div>
                            <p className="text-sm">{item.title}</p>
                            {upload ? (
                              <a
                                className="text-sm font-semibold text-primary underline"
                                href={upload.fileData}
                              >
                                {upload.fileName}
                              </a>
                            ) : null}
                          </div>
                          <NativeSelect
                            value={row.checks[item.id] ?? ""}
                            onChange={(event) => {
                              const mark = event.target.value as CheckMark | "";
                              const checks = { ...row.checks };
                              if (mark === "") delete checks[item.id];
                              else checks[item.id] = mark;
                              void commitRow(row.applicationId, { checks });
                            }}
                            aria-label={item.title}
                          >
                            <option value="">Not reviewed</option>
                            <option value="Received">Received</option>
                            <option value="Missing">Missing</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Not applicable">Not applicable</option>
                          </NativeSelect>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={() => {
                      const blocked = verificationBlock(row);
                      if (blocked) {
                        setNotice(blocked);
                        return;
                      }
                      void commitRow(row.applicationId, { verification: "Approved" });
                      setNotice(
                        `${displayName(row)} can now see ${row.guideName}, and the guide can see this scholar.`,
                      );
                    }}
                  >
                    Approve certificate verification
                  </Button>
                  {missingItems(row).length > 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Still missing on the scholar's file:{" "}
                      {missingItems(row)
                        .map((item) => item.title)
                        .join("; ")}
                      .
                    </p>
                  ) : null}
                </section>
              ))}
          </div>
        </Stage>
      ) : null}
    </div>
  );
}

function Stage({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-primary">{title}</h2>
      <p className="mt-1 mb-4 max-w-3xl text-sm leading-6 text-muted-foreground">
        {text}
      </p>
      {children}
    </section>
  );
}

function Rows({
  rows,
  headers,
  empty,
  render,
}: {
  rows: AdmissionCase[];
  headers: string[];
  empty: string;
  render: (row: AdmissionCase) => ReactNode;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
        <thead className="bg-muted/60">
          <tr>
            {headers.map((header) => (
              <th key={header || "action"} className="px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.applicationId} className="border-t border-border">
              {render(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarksCells({
  row,
  onSave,
}: {
  row: AdmissionCase;
  onSave: (written: string, interview: string) => string | null;
}) {
  const [written, setWritten] = useState(row.written === null ? "" : String(row.written));
  const [interview, setInterview] = useState(
    row.interview === null ? "" : String(row.interview),
  );
  const [error, setError] = useState("");
  return (
    <>
      <td className="px-3 py-2">{displayName(row)}</td>
      <td className="px-3 py-2">{row.department}</td>
      <td className="px-3 py-2">
        <Input
          inputMode="numeric"
          value={written}
          onChange={(event) => setWritten(event.target.value)}
          aria-label={`Written marks for ${row.name}`}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          inputMode="numeric"
          value={interview}
          onChange={(event) => setInterview(event.target.value)}
          aria-label={`Interview marks for ${row.name}`}
        />
      </td>
      <td className="px-3 py-2">{totalMarks(row) ?? "—"}</td>
      <td className="px-3 py-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const next = onSave(written, interview);
            setError(next ?? "");
          }}
        >
          Save marks
        </Button>
        {error ? <p className="mt-1 text-secondary">{error}</p> : null}
      </td>
    </>
  );
}
