"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AdmissionLetter } from "@/components/portal/AdmissionPrint";
import { Button } from "@/components/ui/button";
import { useClientReady } from "@/components/forms/ClientGate";
import { FileUpload } from "@/components/forms/FileUpload";
import { Input } from "@/components/ui/input";
import { admissionChecklist } from "@/data/admission";
import {
  currentAdmission,
  displayName,
  missingItems,
  provisionalOrder,
  saveAdmission,
  subscribeAdmission,
  type AdmissionCase,
} from "@/lib/admission";
import { fileToDataUrl, type StoredFile } from "@/lib/files";
import { sameId } from "@/lib/office";
import { usePortalSession } from "@/lib/use-preview-session";

const feeSchema = z.object({
  feeReference: z.string().min(3, "Enter the payment reference.").max(80),
  feeAmount: z.string().regex(/^\d+$/, "Enter the amount in rupees."),
});

type FeeValues = z.infer<typeof feeSchema>;

export function ScholarAdmission() {
  const ready = useClientReady();
  const session = usePortalSession();
  const store = useSyncExternalStore(subscribeAdmission, currentAdmission, () => null);
  const form = useForm<FeeValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: { feeReference: "", feeAmount: "" },
  });
  const [receipt, setReceipt] = useState<StoredFile | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [notice, setNotice] = useState("");
  const [letterOpen, setLetterOpen] = useState(false);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<StoredFile | null>(null);

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
    return (
      <div>
        <h1 className="font-serif text-3xl text-primary">Admission file</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          The Center for Research has not opened an admission file for this sign-in yet.
        </p>
      </div>
    );
  }

  const missing = missingItems(row);
  const serial =
    provisionalOrder(store.cases).findIndex(
      (item) => item.applicationId === row.applicationId,
    ) + 1;

  async function saveRow(next: AdmissionCase) {
    if (!store) return;
    const cases = store.cases.map((item) =>
      item.applicationId === next.applicationId ? next : item,
    );
    const saved = await saveAdmission({ cases, letter: store.letter });
    setNotice(saved.ok ? "Saved." : saved.message);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Admission
        </p>
        <h1 className="mt-1 font-serif text-3xl text-primary">Admission file</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {row.applicationNo} · {row.department}
        </p>
        {notice ? <p className="mt-2 text-sm text-secondary">{notice}</p> : null}
      </div>

      <section className="rounded-xl border border-border p-4">
        <h2 className="font-semibold">Where the application stands</h2>
        <ul className="mt-2 list-disc pl-5 text-sm leading-6">
          <li>Application fee: {row.payment}.</li>
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
            {row.selected
              ? "On the provisional selection list."
              : "Not on the selection list."}
          </li>
        </ul>
      </section>

      {row.selected ? (
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
              <AdmissionLetter row={row} serial={serial} letter={store.letter} />
            </div>
          ) : null}
        </section>
      ) : null}

      {row.selected ? (
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-semibold">Tuition fee</h2>
          {row.feeReceiptName ? (
            <p className="mt-2 text-sm">
              Uploaded {row.feeReceiptName}
              {row.feeAmount ? ` for ₹${row.feeAmount}` : ""}. Reference{" "}
              {row.feeReference}.
            </p>
          ) : (
            <form
              className="mt-3 grid max-w-lg gap-3"
              onSubmit={form.handleSubmit(async (values) => {
                if (!receipt?.file) {
                  setReceiptError("Choose the fee receipt.");
                  return;
                }
                setReceiptError("");
                const fileData = await fileToDataUrl(receipt.file).catch(() => "");
                if (!fileData) {
                  setReceiptError("The receipt could not be read.");
                  return;
                }
                await saveRow({
                  ...row,
                  feeReference: values.feeReference,
                  feeAmount: values.feeAmount,
                  feeReceiptName: receipt.file.name,
                  feeReceiptData: fileData,
                });
              })}
            >
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Payment reference</span>
                <Input {...form.register("feeReference")} />
                {form.formState.errors.feeReference ? (
                  <span className="mt-1 block text-secondary">
                    {form.formState.errors.feeReference.message}
                  </span>
                ) : null}
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Amount (₹)</span>
                <Input inputMode="numeric" {...form.register("feeAmount")} />
                {form.formState.errors.feeAmount ? (
                  <span className="mt-1 block text-secondary">
                    {form.formState.errors.feeAmount.message}
                  </span>
                ) : null}
              </label>
              <FileUpload
                id="tuition-receipt"
                acceptRule="document"
                value={receipt}
                error={receiptError}
                onChange={setReceipt}
              />
              <Button type="submit" className="w-fit">
                Upload receipt
              </Button>
            </form>
          )}
        </section>
      ) : null}

      {missing.length > 0 ? (
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
            {row.guideName} is your guide for {row.department}.
          </p>
        </section>
      ) : row.selected ? (
        <p className="text-sm text-muted-foreground">
          The guide's name appears here after the office approves the certificates.
        </p>
      ) : null}
    </div>
  );
}
