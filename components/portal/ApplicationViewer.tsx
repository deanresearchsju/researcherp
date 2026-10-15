"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { DeskModal, StatusPill, ViewFilesButton } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { scholarDocuments, supervisorEnclosures } from "@/data/documents";
import {
  applicationReviewCopy,
  scholarApplicationEditFields,
  supervisorApplicationEditFields,
} from "@/data/application-review";
import { scholarPersonSections, supervisorPersonSections } from "@/lib/person-file";
import type { AdmissionCase } from "@/lib/admission";
import { admissionChecklist } from "@/data/admission";
import { isStoredApplication, toJson, type StoredApplication } from "@/lib/records";
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
  const row = asRecord(value);
  if (!row) return null;
  const fileName = textOf(row.fileName) || textOf(row.name);
  const fileData = textOf(row.fileData) || textOf(row.data);
  if (!fileName) return null;
  return { fileName, fileData: fileData.startsWith("data:") ? fileData : null };
}

function payloadFiles(payload: Json, kind: StoredApplication["kind"]): StoredFileRow[] {
  const record = asRecord(payload) ?? {};
  const files = asRecord(record.files);
  const attachments = asRecord(record.attachments);
  const images = asRecord(record.images);
  const specs = kind === "phd" ? scholarDocuments : supervisorEnclosures;
  const rows: StoredFileRow[] = specs.map((spec) => {
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
    }
    if (signature.startsWith("data:")) {
      rows.splice(1, 0, {
        id: "signature-image",
        label: applicationReviewCopy.signature,
        fileName: "signature.jpg",
        fileData: signature,
      });
    }
  }
  const papers = asRecord(record.papers);
  if (papers) {
    Object.entries(papers).forEach(([id, value]) => {
      const named = typeof value === "string" ? value : fileFromUnknown(value)?.fileName;
      const stored = fileFromUnknown(value);
      if (!named && !stored) return;
      rows.push({
        id: `paper-${id}`,
        label: "Publication paper",
        fileName: stored?.fileName || named || "paper",
        fileData: stored?.fileData ?? null,
      });
    });
  }
  return rows.filter((row) => row.fileName);
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
  personId,
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
  const lookupId = personId || application.email || application.applicationNo;
  const canEdit = Boolean(editable && onSave && isStoredApplication(application.id));
  const sections =
    application.kind === "phd"
      ? scholarPersonSections(lookupId, application.applicantName, [application])
      : supervisorPersonSections(lookupId, application.applicantName, [application]);
  const files = payloadFiles(application.payload, application.kind);
  const publications = publicationsOf(application.payload);
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
      ) : (
        <>
          {editable && !isStoredApplication(application.id) ? (
            <p className="text-sm text-muted-foreground">
              {applicationReviewCopy.noStored}
            </p>
          ) : null}
          {sections.map((section) => (
            <section key={section.heading}>
              <h3 className="font-semibold text-primary">{section.heading}</h3>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {section.pairs.map((pair) => (
                  <div key={`${section.heading}-${pair.label}`}>
                    <dt className="text-xs text-muted-foreground">{pair.label}</dt>
                    <dd className="text-sm">{pair.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </>
      )}
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
      {publications.length > 0 ? (
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
        <ul className="mt-2 space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm"
            >
              <div>
                <p className="font-semibold">{file.label}</p>
                <p className="text-muted-foreground">{file.fileName}</p>
                {!file.fileData ? (
                  <p className="text-xs text-muted-foreground">
                    {applicationReviewCopy.noFile}
                  </p>
                ) : null}
              </div>
              <ViewFilesButton fileName={file.fileName} data={file.fileData} />
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
