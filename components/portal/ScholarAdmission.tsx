"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { AdmissionLetter } from "@/components/portal/AdmissionPrint";
import { StatusPill, ViewFilesButton } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { admissionChecklist, admissionLockCopy } from "@/data/admission";
import {
  admissionCompleted,
  currentAdmission,
  missingItems,
  provisionalOrder,
  saveAdmission,
  scholarAdmissionWriteBlock,
  subscribeAdmission,
  type AdmissionCase,
} from "@/lib/admission";
import { fileToDataUrl, type StoredFile } from "@/lib/files";
import { sameId } from "@/lib/office";
import { scholarBySignIn } from "@/lib/register";
import { guideHiddenCopy, guideReleased } from "@/lib/guide-release";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";
import { ApplicationViewer } from "@/components/portal/ApplicationViewer";
import type { StoredApplication } from "@/lib/records";
import { createSupabase } from "@/lib/supabase/client";

/** The scholar's own application, read by its number. */
async function loadOwnApplication(
  applicationNo: string,
): Promise<StoredApplication | null> {
  const supabase = createSupabase();
  if (!supabase || !applicationNo) return null;
  const { data } = await supabase
    .from("phd_applications")
    .select(
      "id, application_no, date_of_birth, applicant_name, email, study_mode, status, payload, created_at",
    )
    .eq("application_no", applicationNo)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    kind: "phd",
    applicationNo: data.application_no,
    applicantName: data.applicant_name,
    email: data.email,
    dateOfBirth: data.date_of_birth,
    studyMode: data.study_mode,
    status: data.status,
    createdAt: data.created_at,
    payload: data.payload,
  };
}

export function ScholarAdmission({ embedded = false }: { embedded?: boolean }) {
  const ready = useClientReady();
  const session = usePortalSession();
  const payments = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  const store = useSyncExternalStore(subscribeAdmission, currentAdmission, () => null);
  const [notice, setNotice] = useState("");
  const [letterOpen, setLetterOpen] = useState(false);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<StoredFile | null>(null);
  const [application, setApplication] = useState<StoredApplication | null>(null);
  const [opening, setOpening] = useState(false);

  if (!ready || !store) {
    return <p className="text-sm text-muted-foreground">Loading your admission file…</p>;
  }
  if (!session || session.role !== "scholar") {
    return (
      <p className="text-sm">
        <Link
          href="/login/scholar"
          className="font-semibold text-primary hover:underline"
        >
          Sign in as a scholar
        </Link>
        .
      </p>
    );
  }

  const row = store.cases.find(
    (item) =>
      sameId(item.email, session.identifier) ||
      sameId(item.applicationNo, session.identifier),
  );
  if (!row) {
    const onRegister = scholarBySignIn(session.identifier);
    if (embedded) return null;
    return (
      <div>
        <h1 className="font-serif text-3xl text-primary">Admission file</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {onRegister
            ? admissionLockCopy.scholarComplete
            : "The Center for Research has not opened an admission file for this sign-in yet."}
        </p>
        {onRegister ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {admissionLockCopy.scholarFrozen}
          </p>
        ) : null}
      </div>
    );
  }

  const currentRow: AdmissionCase = row;
  const frozen = admissionCompleted(currentRow);

  const missing = missingItems(currentRow);
  const serial =
    provisionalOrder(store.cases).findIndex(
      (item) => item.applicationId === currentRow.applicationId,
    ) + 1;

  async function saveRow(next: AdmissionCase) {
    if (!store) return;
    const blocked = scholarAdmissionWriteBlock(currentRow);
    if (blocked) {
      setNotice(blocked);
      return;
    }
    const cases = store.cases.map((item) =>
      item.applicationId === next.applicationId ? next : item,
    );
    const saved = await saveAdmission({ cases, letter: store.letter });
    setNotice(saved.ok ? "Saved." : saved.message);
  }

  async function openApplication() {
    setOpening(true);
    const found = await loadOwnApplication(currentRow.applicationNo);
    setOpening(false);
    if (!found) {
      setNotice("Your application could not be opened. Write to the research office.");
      return;
    }
    setApplication(found);
  }

  return (
    <div
      id="admission"
      className={
        embedded
          ? "scroll-mt-24 space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
          : "space-y-6"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
            Admission
          </p>
          {embedded ? (
            <h2 className="mt-1 font-heading text-2xl text-primary">
              Admission application
            </h2>
          ) : (
            <h1 className="mt-1 font-serif text-3xl text-primary">Admission file</h1>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {row.applicationNo} · {row.department}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={opening}
          data-readonly-allow
          onClick={() => void openApplication()}
        >
          {opening ? "Opening…" : "View full application"}
        </Button>
      </div>
      <div>
        {notice ? <p className="mt-2 text-sm text-secondary">{notice}</p> : null}
        {frozen ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            {admissionLockCopy.scholarFrozen}
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Where the application stands</h2>
        <ul className="mt-2 list-disc pl-5 text-sm leading-6">
          <li className="flex flex-wrap items-center gap-2">
            Application fee: <StatusPill status={row.payment} />
          </li>
          <li>
            {row.shortlisted
              ? "Shortlisted for the entrance and interview."
              : "Not shortlisted."}
          </li>
          <li>
            {row.attendance === "Present"
              ? "Present for the entrance and interview."
              : row.attendance === "Absent"
                ? "Marked absent."
                : "Attendance has not been marked."}
          </li>
          <li>
            {row.reporting
              ? `Provisional admission cancelled: ${row.reporting.toLowerCase()}.`
              : row.selected
                ? "On the provisional selection list."
                : row.waitlistRank !== null
                  ? `On the waiting list for ${row.department} (W${row.waitlistRank}).`
                  : "Not on the selection list."}
          </li>
        </ul>
      </section>

      {row.selected && row.letterIssued ? (
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-semibold">Provisional admission letter</h2>
          <Button type="button" className="mt-3" onClick={() => setLetterOpen(true)}>
            Open letter
          </Button>
          {letterOpen ? (
            <div className="mt-4">
              <div className="no-print mb-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLetterOpen(false)}
                >
                  Close
                </Button>
                <Button type="button" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
              <AdmissionLetter
                row={row}
                serial={row.letterNo ?? serial}
                letter={store.letter}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {row.selected ? (
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-semibold">Fee</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pay the annual research fee under Fee in this portal and upload the receipt
            there. The research office verifies it.
          </p>
          <Link
            href="/scholar/fee"
            className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground"
          >
            Go to Fee
          </Link>
        </section>
      ) : null}

      {admissionChecklist.some((item) => row.uploads[item.id]) ? (
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-semibold">Submitted documents</h2>
          <ul className="mt-3 space-y-2">
            {admissionChecklist.map((item) => {
              const upload = row.uploads[item.id];
              if (!upload) return null;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{upload.fileName}</p>
                  </div>
                  <ViewFilesButton fileName={upload.fileName} data={upload.fileData} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {missing.length > 0 && !frozen ? (
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-semibold">Still to be submitted</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These items stay here until you upload them.
          </p>
          <ul className="mt-3 space-y-3">
            {missing.map((item) => (
              <li key={item.id} className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-semibold">{item.title}</p>
                {uploadFor === item.id ? (
                  <div className="mt-2 space-y-2">
                    <FileUpload
                      id={`check-${item.id}`}
                      acceptRule="document"
                      value={uploadFile}
                      onChange={setUploadFile}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (!uploadFile?.file) {
                          setNotice("Choose the document.");
                          return;
                        }
                        const file = uploadFile.file;
                        void fileToDataUrl(file).then((fileData) => {
                          if (!fileData) return;
                          const checklistItem = admissionChecklist.find(
                            (entry) => entry.id === item.id,
                          );
                          if (!checklistItem) return;
                          void saveRow({
                            ...row,
                            checks: { ...row.checks, [item.id]: "Submitted" },
                            uploads: {
                              ...row.uploads,
                              [item.id]: { fileName: file.name, fileData },
                            },
                          });
                          setUploadFor(null);
                          setUploadFile(null);
                        });
                      }}
                    >
                      Submit
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-2"
                    variant="outline"
                    onClick={() => {
                      setUploadFor(item.id);
                      setUploadFile(null);
                    }}
                  >
                    Upload
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {row.verification === "Approved" && row.guideName ? (
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-semibold">Guide</h2>
          <p className="mt-2 text-sm">
            {guideReleased(session.identifier, payments?.records ?? [])
              ? `${row.guideName} is your guide for ${row.department}.`
              : guideHiddenCopy}
          </p>
          {!guideReleased(session.identifier, payments?.records ?? []) ? (
            <Link
              href="/scholar/fee"
              className="mt-3 inline-flex h-9 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground"
            >
              Pay the fee
            </Link>
          ) : null}
        </section>
      ) : row.selected ? (
        <p className="text-sm text-muted-foreground">
          The guide&apos;s name appears after your documents are verified and the first
          fee payment is verified.
        </p>
      ) : null}
      {application ? (
        <ApplicationViewer
          application={application}
          admission={currentRow}
          onClose={() => setApplication(null)}
        />
      ) : null}
    </div>
  );
}
