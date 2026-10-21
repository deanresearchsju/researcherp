"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PhdApplicationSheet } from "@/components/forms/scholar/PhdApplicationSheet";
import { SupervisorApplicationSheet } from "@/components/forms/supervisor/SupervisorApplicationSheet";
import { DeskModal, StatusPill, ViewFilesButton } from "@/components/portal/Desk";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { scholarDocuments, supervisorEnclosures } from "@/data/documents";
import {
  applicationReviewCopy,
  scholarApplicationEditFields,
  supervisorApplicationEditFields,
} from "@/data/application-review";
import type { AdmissionCase } from "@/lib/admission";
import { admissionChecklist } from "@/data/admission";
import { downloadPhdApplications } from "@/lib/phd-application-pdf";
import { compressImage, fileToDataUrl } from "@/lib/files";
import {
  attachApplicationFile,
  isStoredApplication,
  toJson,
  type StoredApplication,
} from "@/lib/records";
import { phdReceiptFromApplication } from "@/lib/scholar-progress";
import { supervisorReceiptFromApplication } from "@/lib/supervisor-application";
import { downloadSupervisorApplications } from "@/lib/supervisor-application-pdf";
import { isOfficeRole } from "@/lib/access";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { usePreviewSession } from "@/lib/use-preview-session";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";

export type ReviewAction = "Accepted" | "Approved" | "Rejected";

type StoredFileRow = {
  id: string;
  label: string;
  fileName: string;
  fileData: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function fileFromUnknown(
  value: unknown,
): { fileName: string; fileData: string | null } | null {
  if (typeof value === "string") {
    if (value.startsWith("data:")) return { fileName: "file", fileData: value };
    return value.trim() ? { fileName: value.trim(), fileData: null } : null;
  }
  const row = asRecord(value);
  if (!row) return null;
  const fileName = textOf(row.fileName) || textOf(row.name);
  const fileData = textOf(row.fileData) || textOf(row.data);
  const data = fileData.startsWith("data:") ? fileData : null;
  if (!fileName && !data) return null;
  return { fileName: fileName || "file", fileData: data };
}

function payloadFiles(payload: Json, kind: StoredApplication["kind"]): StoredFileRow[] {
  const record = asRecord(payload) ?? {};
  const files = asRecord(record.files);
  const attachments = asRecord(record.attachments);
  const images = asRecord(record.images);
  const specs = kind === "phd" ? scholarDocuments : supervisorEnclosures;
  const seen = new Set<string>();
  const rows: StoredFileRow[] = specs.map((spec) => {
    seen.add(spec.id);
    const stored = files ? fileFromUnknown(files[spec.id]) : null;
    const named = attachments ? textOf(attachments[spec.id]) : "";
    return {
      id: spec.id,
      label: spec.label,
      fileName: stored?.fileName || named,
      fileData: stored?.fileData ?? null,
    };
  });
  if (images) {
    const photo = textOf(images.photo);
    const signature = textOf(images.signature);
    if (photo.startsWith("data:")) {
      rows.unshift({
        id: "photo-image",
        label: applicationReviewCopy.photo,
        fileName: "photograph.jpg",
        fileData: photo,
      });
      seen.add("photo-image");
    }
    if (signature.startsWith("data:")) {
      rows.splice(1, 0, {
        id: "signature-image",
        label: applicationReviewCopy.signature,
        fileName: "signature.jpg",
        fileData: signature,
      });
      seen.add("signature-image");
    }
  }
  const papers = asRecord(record.papers);
  if (papers) {
    Object.entries(papers).forEach(([id, value], index) => {
      const fromFiles = files ? fileFromUnknown(files[id]) : null;
      const fromPaper = fileFromUnknown(value);
      const fileName =
        fromFiles?.fileName || fromPaper?.fileName || `publication-${index + 1}`;
      const fileData = fromFiles?.fileData ?? fromPaper?.fileData ?? null;
      if (!fileName && !fileData) return;
      seen.add(id);
      seen.add(`paper-${id}`);
      rows.push({
        id: `paper-${id}`,
        label: `Publication paper ${index + 1}`,
        fileName,
        fileData,
      });
    });
  }
  if (files) {
    Object.entries(files).forEach(([id, value]) => {
      if (seen.has(id) || id === "photo" || id === "signature") return;
      const stored = fileFromUnknown(value);
      if (!stored) return;
      seen.add(id);
      rows.push({
        id,
        label: stored.fileName,
        fileName: stored.fileName,
        fileData: stored.fileData,
      });
    });
  }
  return rows.filter((row) => row.fileName || row.fileData);
}

function publicationsOf(payload: Json) {
  const record = asRecord(payload);
  const list = record?.publications;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const line = [row.title, row.journal, row.year, row.indexing, row.authors]
      .map(textOf)
      .filter(Boolean)
      .join(" · ");
    return line ? [line] : [];
  });
}

const commentsSchema = z.object({
  remarks: z
    .string()
    .trim()
    .min(2, "Enter comments.")
    .max(500, "Use 500 characters or fewer."),
  quota: z.string().trim(),
});

type CommentsValues = z.infer<typeof commentsSchema>;

type EditField = {
  key: string;
  label: string;
  multiline?: boolean;
};

function applicationEditFields(kind: StoredApplication["kind"]): readonly EditField[] {
  return kind === "phd" ? scholarApplicationEditFields : supervisorApplicationEditFields;
}

function payloadRecord(payload: Json) {
  const record = asRecord(payload);
  return record ?? {};
}

function initialEditValues(application: StoredApplication) {
  const record = payloadRecord(application.payload);
  const values: Record<string, string> = {};
  for (const field of applicationEditFields(application.kind)) {
    values[field.key] = textOf(record[field.key]);
  }
  if (application.kind === "phd") {
    if (!values.fullName) values.fullName = application.applicantName;
    if (!values.email) values.email = application.email;
  } else {
    if (!values.name) values.name = application.applicantName;
    if (!values.email) values.email = application.email;
  }
  return values;
}

function ApplicationEditForm({
  application,
  busy,
  onSave,
}: {
  application: StoredApplication;
  busy: boolean;
  onSave: (next: { applicantName: string; email: string; payload: Json }) => void;
}) {
  const fields = applicationEditFields(application.kind);
  const [values, setValues] = useState(() => initialEditValues(application));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const record = payloadRecord(application.payload);
        const nextPayload = toJson({ ...record, ...values });
        const applicantName =
          application.kind === "phd"
            ? values.fullName.trim() || application.applicantName
            : values.name.trim() || application.applicantName;
        onSave({
          applicantName,
          email: values.email.trim() || application.email,
          payload: nextPayload,
        });
      }}
      noValidate
    >
      <p className="text-sm text-muted-foreground sm:col-span-2">
        {applicationReviewCopy.editHint}
      </p>
      {fields.map((field) => {
        const id = `application-edit-${field.key}`;
        return (
          <FormField
            key={field.key}
            label={field.label}
            htmlFor={id}
            className={field.multiline ? "sm:col-span-2" : undefined}
          >
            {field.multiline ? (
              <Textarea
                id={id}
                value={values[field.key] ?? ""}
                className="min-h-24"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
              />
            ) : (
              <Input
                id={id}
                value={values[field.key] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
              />
            )}
          </FormField>
        );
      })}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="gold" disabled={busy}>
          {applicationReviewCopy.saveChanges}
        </Button>
      </div>
    </form>
  );
}

export function ApplicationViewer({
  application,
  admission,
  onClose,
  review,
  editable,
  saving,
  onSave,
}: {
  application: StoredApplication;
  admission?: AdmissionCase | null;
  onClose: () => void;
  review?: {
    busy: boolean;
    onAction: (action: ReviewAction, remarks: string, quota: string) => void;
  };
  personId?: string;
  editable?: boolean;
  saving?: boolean;
  onSave?: (next: { applicantName: string; email: string; payload: Json }) => void;
}) {
  const canDownload = useCanMenuAction("export");
  const canEdit = Boolean(editable && onSave && isStoredApplication(application.id));
  const isPhd = application.kind === "phd";
  const isSupervisor = application.kind === "supervisor";
  const viewer = usePreviewSession();
  // Scholars and supervisors only read here; downloads stay with the research office.
  const officeViewer = viewer ? isOfficeRole(viewer.role) : false;
  const canUpload =
    (viewer?.role === "admin" || viewer?.role === "staff") &&
    isStoredApplication(application.id);
  const [uploaded, setUploaded] = useState<
    Record<string, { fileName: string; fileData: string }>
  >({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const allFiles = payloadFiles(application.payload, application.kind);
  const photoRow = allFiles.find((row) => row.id === "photo-image");
  const signatureRow = allFiles.find((row) => row.id === "signature-image");
  const identityRows: StoredFileRow[] = isPhd
    ? [
        {
          id: "photo",
          label: applicationReviewCopy.photo,
          fileName: photoRow?.fileName ?? "photograph",
          fileData: photoRow?.fileData ?? null,
        },
        {
          id: "signature",
          label: applicationReviewCopy.signature,
          fileName: signatureRow?.fileName ?? "signature",
          fileData: signatureRow?.fileData ?? null,
        },
      ]
    : [];
  const files = [
    ...identityRows,
    ...allFiles.filter(
      (row) =>
        row.id !== "photo-image" &&
        row.id !== "signature-image" &&
        row.id !== "photo" &&
        row.id !== "signature",
    ),
  ].map((row) => (uploaded[row.id] ? { ...row, ...uploaded[row.id] } : row));

  async function uploadCopy(row: StoredFileRow, file: File) {
    const image = row.id === "photo" || row.id === "signature";
    const types = image
      ? ["image/jpeg", "image/png"]
      : ["application/pdf", "image/jpeg", "image/png"];
    if (!types.includes(file.type)) {
      setUploadNotice(image ? "Use a JPG or PNG image." : "Use a PDF, JPG or PNG file.");
      return;
    }
    if (!image && file.size > 5 * 1024 * 1024) {
      setUploadNotice("The file must be 5 MB or smaller.");
      return;
    }
    setUploadingId(row.id);
    setUploadNotice(null);
    try {
      const prepared = image ? await compressImage(file, 300 * 1024) : file;
      const fileData = await fileToDataUrl(prepared);
      const saved = await attachApplicationFile(
        application.kind,
        application.id,
        row.id,
        file.name,
        fileData,
      );
      if (!saved.ok) {
        setUploadNotice(saved.message);
        return;
      }
      setUploaded((current) => ({
        ...current,
        [row.id]: { fileName: file.name, fileData },
      }));
      setUploadNotice(`${row.label} saved with the application.`);
    } catch {
      setUploadNotice("The file could not be read. Try another copy.");
    } finally {
      setUploadingId(null);
    }
  }
  const publications = publicationsOf(application.payload);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const form = useForm<CommentsValues>({
    resolver: zodResolver(commentsSchema),
    defaultValues: { remarks: "", quota: "" },
  });
  const waiting = useMemo(() => {
    if (application.kind !== "supervisor") return [];
    if (application.status === "Approved" || application.status === "Rejected") return [];
    if (application.status === "Accepted") return ["Approved", "Rejected"] as const;
    return ["Accepted", "Rejected"] as const;
  }, [application.kind, application.status]);

  return (
    <DeskModal
      title={`${application.applicationNo} · ${application.applicantName}`}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">Status: {application.status}</p>
      {canEdit && onSave ? (
        <ApplicationEditForm
          key={application.id}
          application={application}
          busy={Boolean(saving)}
          onSave={onSave}
        />
      ) : null}
      {editable && !isStoredApplication(application.id) ? (
        <p className="text-sm text-muted-foreground">{applicationReviewCopy.noStored}</p>
      ) : null}
      {isPhd || isSupervisor ? (
        <div>
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            {canDownload && officeViewer ? (
              <Button
                type="button"
                variant="gold"
                size="sm"
                disabled={pdfBusy}
                onClick={() => {
                  setPdfBusy(true);
                  setPdfNotice(null);
                  const job = isPhd
                    ? downloadPhdApplications([phdReceiptFromApplication(application)])
                    : downloadSupervisorApplications([
                        supervisorReceiptFromApplication(application),
                      ]);
                  void job
                    .catch(() => {
                      setPdfNotice(applicationReviewCopy.downloadFailed);
                    })
                    .finally(() => setPdfBusy(false));
                }}
              >
                {pdfBusy
                  ? applicationReviewCopy.downloadingPdf
                  : applicationReviewCopy.downloadPdf}
              </Button>
            ) : null}
            {pdfNotice ? (
              <p role="status" className="text-sm text-secondary">
                {pdfNotice}
              </p>
            ) : null}
          </div>
          {isPhd ? (
            <PhdApplicationSheet receipt={phdReceiptFromApplication(application)} />
          ) : (
            <SupervisorApplicationSheet
              receipt={supervisorReceiptFromApplication(application)}
            />
          )}
        </div>
      ) : null}
      {admission ? (
        <section>
          <h3 className="font-semibold text-primary">{applicationReviewCopy.payment}</h3>
          <p className="mt-2 text-sm">
            <StatusPill status={admission.payment} />
            {admission.feeAmount ? ` · ₹${admission.feeAmount}` : ""}
            {admission.feeReference ? ` · ${admission.feeReference}` : ""}
          </p>
          {admission.feeReceiptName ? (
            <div className="mt-2">
              <ViewFilesButton
                fileName={admission.feeReceiptName}
                data={admission.feeReceiptData}
              />
            </div>
          ) : null}
        </section>
      ) : null}
      {publications.length > 0 && !isSupervisor ? (
        <section>
          <h3 className="font-semibold text-primary">
            {applicationReviewCopy.publications}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {publications.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h3 className="font-semibold text-primary">
          {applicationReviewCopy.certificates}
        </h3>
        {uploadNotice ? (
          <p role="status" className="mt-2 text-sm text-secondary">
            {uploadNotice}
          </p>
        ) : null}
        <ul className="mt-2 space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm",
                file.fileData
                  ? "bg-muted/50"
                  : "border border-secondary/25 bg-secondary/5",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold">{file.label}</p>
                <p className="truncate text-muted-foreground">{file.fileName}</p>
                {!file.fileData ? (
                  <p className="text-xs font-medium text-secondary">
                    {applicationReviewCopy.noFile}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {file.fileData ? (
                  <ViewFilesButton
                    fileName={file.fileName || file.label}
                    data={file.fileData}
                  />
                ) : null}
                {canUpload ? (
                  <label
                    className={buttonVariants({
                      size: "sm",
                      variant: file.fileData ? "ghost" : "outline",
                      className: cn(
                        "cursor-pointer",
                        uploadingId === file.id && "pointer-events-none opacity-60",
                      ),
                    })}
                  >
                    {uploadingId === file.id
                      ? "Saving…"
                      : file.fileData
                        ? "Replace"
                        : "Upload copy"}
                    <input
                      type="file"
                      className="sr-only"
                      accept={
                        file.id === "photo" || file.id === "signature"
                          ? "image/jpeg,image/png"
                          : "application/pdf,image/jpeg,image/png"
                      }
                      disabled={uploadingId !== null}
                      onChange={(event) => {
                        const chosen = event.target.files?.[0];
                        event.target.value = "";
                        if (chosen) void uploadCopy(file, chosen);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </li>
          ))}
          {admission
            ? admissionChecklist.flatMap((item) => {
                const upload = admission.uploads[item.id];
                if (!upload) return [];
                return [
                  <li
                    key={`check-${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-muted-foreground">{upload.fileName}</p>
                    </div>
                    <ViewFilesButton fileName={upload.fileName} data={upload.fileData} />
                  </li>,
                ];
              })
            : null}
        </ul>
      </section>
      {review && waiting.length > 0 ? (
        <section className="border-t border-border pt-4">
          <div className="flex flex-wrap gap-2">
            {waiting.some((item) => item === "Accepted") ? (
              <Button type="button" variant="gold" onClick={() => setAction("Accepted")}>
                {applicationReviewCopy.accept}
              </Button>
            ) : null}
            {waiting.some((item) => item === "Approved") ? (
              <Button type="button" variant="gold" onClick={() => setAction("Approved")}>
                {applicationReviewCopy.approve}
              </Button>
            ) : null}
            <Button type="button" variant="maroon" onClick={() => setAction("Rejected")}>
              {applicationReviewCopy.reject}
            </Button>
          </div>
          {action ? (
            <form
              className="mt-4 grid gap-3"
              onSubmit={form.handleSubmit((values) => {
                if (action === "Approved") {
                  const quota = Number(values.quota);
                  if (!Number.isInteger(quota) || quota < 0 || quota > 30) {
                    form.setError("quota", { message: "Enter the approved quota." });
                    return;
                  }
                }
                review.onAction(action, values.remarks, values.quota);
              })}
              noValidate
            >
              {action === "Approved" ? (
                <FormField
                  label="Approved quota"
                  htmlFor="review-quota"
                  required
                  error={form.formState.errors.quota?.message}
                >
                  <input
                    id="review-quota"
                    className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
                    inputMode="numeric"
                    {...form.register("quota")}
                  />
                </FormField>
              ) : null}
              <FormField
                label={applicationReviewCopy.comments}
                htmlFor="review-comments"
                required
                hint={applicationReviewCopy.commentsHint}
                error={form.formState.errors.remarks?.message}
              >
                <textarea
                  id="review-comments"
                  className="min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
                  {...form.register("remarks")}
                />
              </FormField>
              <div className="flex gap-2">
                <Button type="submit" variant="gold" disabled={review.busy}>
                  {action === "Accepted"
                    ? applicationReviewCopy.accept
                    : action === "Approved"
                      ? applicationReviewCopy.approve
                      : applicationReviewCopy.reject}
                </Button>
                <Button type="button" variant="outline" onClick={() => setAction(null)}>
                  {applicationReviewCopy.close}
                </Button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </DeskModal>
  );
}
