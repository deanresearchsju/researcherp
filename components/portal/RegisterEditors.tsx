"use client";

import { Camera, ImageOff, PencilLine, Plus } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ImageCropper } from "@/components/forms/ImageCropper";
import { DeskTabs, FormDialog } from "@/components/portal/Desk";
import { RecordForm } from "@/components/portal/ScholarRecordScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  researchRegister,
  type ResearchScholar,
  type ResearchSupervisor,
} from "@/data/research-register";
import { menuByKind } from "@/data/scholar-records";
import { fileLimits, studyModes } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import { compressImage, fileToDataUrl } from "@/lib/files";
import {
  currentDoctoral,
  enrollmentFor,
  saveEnrollment,
  subscribeDoctoral,
} from "@/lib/doctoral";
import { sameId } from "@/lib/office";
import { fetchProfilePhotos, profilePhotoKey, saveProfilePhoto } from "@/lib/profile-photo";
import {
  currentAllotments,
  originalScholar,
  registrationOf,
  saveScholarEdit,
  saveSupervisorEdit,
  scholarEditOf,
  scholarSignInId,
  originalSupervisorKey,
  supervisorEditOf,
  type ScholarEditField,
  type SupervisorEditField,
} from "@/lib/register";
import {
  currentScholarRecords,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { usePreviewSession } from "@/lib/use-preview-session";
import { formatInr } from "@/lib/utils";

const paymentMenu = menuByKind("payment");

type FieldSpec<K extends string> = {
  name: K;
  label: string;
  kind?: "text" | "email" | "tel" | "textarea" | "select";
  options?: readonly string[];
  /** Shown instead of the stored value, such as a batch name for its id. */
  labels?: Record<string, string>;
  wide?: boolean;
};

function scholarKeys(scholar: ResearchScholar) {
  const original = originalScholar(scholar.id);
  return [
    scholarSignInId(scholar),
    scholar.email,
    scholar.registrationNumber,
    scholar.applicationNumber,
    scholar.fileNumber,
    scholar.id,
    original?.email ?? "",
  ].filter((key) => key.trim());
}

/** Distinct choices (ignoring case), keeping the current value even when it is unusual. */
function options(values: readonly string[], current: string) {
  const seen = new Set<string>();
  const list = values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return current && !list.includes(current) ? [current, ...list] : list;
}

function EditFields<K extends string>({
  specs,
  values,
  onChange,
}: {
  specs: readonly FieldSpec<K>[];
  values: Record<K, string>;
  onChange: (name: K, value: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {specs.map((spec) => {
        const id = `register-${spec.name}`;
        const value = values[spec.name] ?? "";
        return (
          <FormField
            key={spec.name}
            label={spec.label}
            htmlFor={id}
            className={spec.wide ? "sm:col-span-2" : undefined}
          >
            {spec.kind === "select" ? (
              <NativeSelect
                id={id}
                value={value}
                onChange={(event) => onChange(spec.name, event.target.value)}
              >
                <option value="">—</option>
                {options(spec.options ?? [], value).map((option) => (
                  <option key={option} value={option}>
                    {spec.labels?.[option] ?? option}
                  </option>
                ))}
              </NativeSelect>
            ) : spec.kind === "textarea" ? (
              <Textarea
                id={id}
                rows={2}
                value={value}
                onChange={(event) => onChange(spec.name, event.target.value)}
              />
            ) : (
              <Input
                id={id}
                type={spec.kind ?? "text"}
                value={value}
                onChange={(event) => onChange(spec.name, event.target.value)}
              />
            )}
          </FormField>
        );
      })}
    </div>
  );
}

function EditedLine({ on, by }: { on?: string; by?: string }) {
  if (!on) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Last corrected{by ? ` by ${by}` : ""} on {formatIsoDate(on.slice(0, 10))}.
    </p>
  );
}

/** The scholar's profile photo, set by the office (saved at once, apart from the details). */
function ScholarPhotoField({ scholar }: { scholar: ResearchScholar }) {
  const keys = [
    scholarSignInId(scholar),
    scholar.email,
    registrationOf(scholar, currentAllotments()),
  ].filter((key, index, list) => key.trim() && list.indexOf(key) === index);
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);

  useEffect(() => {
    let live = true;
    void fetchProfilePhotos("scholar", keys).then((found) => {
      if (!live) return;
      const first = keys.map((key) => found.get(profilePhotoKey("scholar", key))).find(Boolean);
      setPhoto(first ?? null);
    });
    return () => {
      live = false;
    };
    // The keys come from the scholar; reload only when the scholar changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholar.id]);

  function choose(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setMessage("Choose a JPG or PNG photo.");
      return;
    }
    setMessage(null);
    setPending(file);
  }

  async function save(cropped: File) {
    setBusy(true);
    setMessage(null);
    try {
      const small = await compressImage(cropped, fileLimits.photo.maxBytes);
      const data = await fileToDataUrl(small);
      for (const key of keys) await saveProfilePhoto("scholar", key, data);
      setPhoto(data);
      setMessage("Photo saved.");
    } catch {
      setMessage("That photo could not be saved. Try a smaller JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/40 p-3">
      <div className="grid h-[5.6rem] w-[4.4rem] shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-card">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${scholar.name} photo`} className="size-full object-cover" />
        ) : (
          <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-semibold text-primary">
          {photo === undefined ? "Loading photo…" : photo ? "Photo" : "No photo yet"}
        </p>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-primary hover:bg-muted">
          <Camera className="size-4" aria-hidden="true" />
          {busy ? "Saving…" : photo ? "Change photo" : "Upload photo"}
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {message ? (
          <p role="status" className="text-xs text-secondary">
            {message}
          </p>
        ) : null}
      </div>
      {pending ? (
        <ImageCropper
          file={pending}
          aspect={3.5 / 4.5}
          maxBytes={fileLimits.photo.maxBytes}
          onCancel={() => setPending(null)}
          onConfirm={(cropped) => {
            setPending(null);
            void save(cropped);
          }}
          onError={(text) => {
            setPending(null);
            setMessage(text);
          }}
        />
      ) : null}
    </div>
  );
}

/** Office correction of a scholar's register details and fee payments. */
export function ScholarRegisterEditor({
  scholar,
  onClose,
  onDone,
}: {
  scholar: ResearchScholar;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [tab, setTab] = useState("details");
  const [values, setValues] = useState<Record<ScholarEditField, string>>(() => ({
    name: scholar.name,
    fileNumber: scholar.fileNumber,
    applicationNumber: scholar.applicationNumber,
    department: scholar.department,
    batchId: scholar.batchId,
    phone: scholar.phone,
    email: scholar.email,
    title: scholar.title,
    category: scholar.category,
    institution: scholar.institution,
    guideName: scholar.guideName,
    firstDc: scholar.firstDc,
    secondDc: scholar.secondDc,
    confirmation: scholar.confirmation,
    colloquium1: scholar.colloquium1,
    colloquium2: scholar.colloquium2,
    synopsis: scholar.synopsis,
    thesis: scholar.thesis,
    viva: scholar.viva,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<ScholarRecord | "new" | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const edit = scholarEditOf(scholar.id);

  const departments = researchRegister.scholars.map((item) => item.department);
  const guides = researchRegister.supervisors.map((item) => item.name);
  const sections: { title: string; specs: FieldSpec<ScholarEditField>[] }[] = [
    {
      title: "Identity",
      specs: [
        { name: "name", label: "Name", wide: true },
        { name: "fileNumber", label: "File number" },
        { name: "applicationNumber", label: "Application number" },
        {
          name: "batchId",
          label: "Batch",
          kind: "select",
          options: researchRegister.batches.map((batch) => batch.id),
          labels: Object.fromEntries(
            researchRegister.batches.map((batch) => [batch.id, batch.name]),
          ),
        },
        { name: "department", label: "Department", kind: "select", options: departments },
      ],
    },
    {
      title: "Contact",
      specs: [
        { name: "phone", label: "Phone", kind: "tel" },
        { name: "email", label: "Email", kind: "email" },
      ],
    },
    {
      title: "Programme",
      specs: [
        { name: "category", label: "Mode of study", kind: "select", options: studyModes },
        { name: "institution", label: "Working institution" },
        { name: "guideName", label: "Guide", kind: "select", options: guides, wide: true },
        { name: "title", label: "Research title", kind: "textarea", wide: true },
      ],
    },
    {
      title: "Milestones before the ERP",
      specs: [
        { name: "firstDc", label: "1st DC" },
        { name: "secondDc", label: "2nd DC" },
        { name: "confirmation", label: "Confirmation" },
        { name: "colloquium1", label: "Colloquium 1" },
        { name: "colloquium2", label: "Colloquium 2" },
        { name: "synopsis", label: "Synopsis" },
        { name: "thesis", label: "Thesis" },
        { name: "viva", label: "Viva" },
      ],
    },
  ];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const saved = await saveScholarEdit(scholar.id, values);
    if (!saved.ok) {
      setBusy(false);
      setError("message" in saved ? saved.message : "The details could not be saved.");
      return;
    }
    // The course-work enrolment carries the mode of study too; keep both the same.
    const enrollment = doctoral
      ? scholarKeys(scholar)
          .map((key) => enrollmentFor(doctoral, key))
          .find((item) => item !== null)
      : null;
    if (enrollment && values.category.trim() && enrollment.studyMode !== values.category.trim()) {
      const { id: _id, ...rest } = enrollment;
      void _id;
      await saveEnrollment({ ...rest, studyMode: values.category.trim() });
    }
    setBusy(false);
    onDone(`${values.name.trim() || scholar.name}: register details saved.`);
  }

  return (
    <>
    <FormDialog
      title={`Edit scholar · ${scholar.name}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Save details"
      size="lg"
    >
      <DeskTabs
        tabs={[
          { id: "details", label: "Details" },
          { id: "fee", label: "Fee payments" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "details" ? (
        <div className="space-y-6">
          <ScholarPhotoField scholar={scholar} />
          {sections.map((section) => (
            <fieldset key={section.title} className="space-y-3">
              <legend className="text-xs font-bold tracking-[0.16em] text-secondary uppercase">
                {section.title}
              </legend>
              <EditFields
                specs={section.specs}
                values={values}
                onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
              />
            </fieldset>
          ))}
          <EditedLine on={edit?.editedOn} by={edit?.editedBy} />
        </div>
      ) : (
        <ScholarFeePayments
          scholar={scholar}
          notice={paymentNotice}
          onEdit={(record) => {
            setPaymentNotice(null);
            setPayment(record);
          }}
        />
      )}
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
    {payment ? (
      // Beside the dialog, not inside it, so saving a payment does not submit the details form.
      <RecordForm
        key={payment === "new" ? "new" : payment.id}
        officeEntry
        menu={paymentMenu}
        scholarIdentifier={payment === "new" ? scholarSignInId(scholar) : payment.scholarIdentifier}
        scholarName={scholar.name}
        supervisorIdentifier=""
        supervisorName=""
        existing={payment === "new" ? undefined : payment}
        onClose={() => setPayment(null)}
        onDone={(message) => {
          setPayment(null);
          setPaymentNotice(message);
        }}
      />
    ) : null}
    </>
  );
}

function ScholarFeePayments({
  scholar,
  notice,
  onEdit,
}: {
  scholar: ResearchScholar;
  notice: string | null;
  onEdit: (record: ScholarRecord | "new") => void;
}) {
  const session = usePreviewSession();
  const isAdmin = session?.role === "admin";
  const load = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );

  if (!load) return <p className="text-sm text-muted-foreground">Loading payments…</p>;
  const keys = scholarKeys(scholar);
  const payments = load.records
    .filter((record) => keys.some((key) => sameId(record.scholarIdentifier, key)))
    .sort((left, right) =>
      (right.payload.paidOn ?? right.createdAt).localeCompare(left.payload.paidOn ?? left.createdAt),
    );
  const verified = payments
    .filter((record) => record.status === "Approved")
    .reduce((sum, record) => sum + (Number(record.payload.amount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Verified total{" "}
          <span className="font-semibold text-primary">₹{formatInr(verified)}</span> ·{" "}
          {payments.length} payment{payments.length === 1 ? "" : "s"}
        </p>
        <Button type="button" size="sm" variant="gold" onClick={() => onEdit("new")}>
          <Plus className="size-4" aria-hidden="true" />
          Add payment
        </Button>
      </div>
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {payments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No payment on record.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                {["Paid on", "Purpose", "Amount", "Mode · Transaction", "Status", ""].map(
                  (heading) => (
                    <th key={heading} className="px-3 py-2 font-semibold">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {payments.map((record) => (
                <tr key={record.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {record.payload.paidOn ? formatIsoDate(record.payload.paidOn) : "—"}
                  </td>
                  <td className="px-3 py-2">{record.payload.purpose || "—"}</td>
                  <td className="px-3 py-2 font-medium text-primary tabular-nums">
                    ₹{formatInr(Number(record.payload.amount) || 0)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {record.payload.mode || "—"}
                    <br />
                    {record.payload.transactionNumber || ""}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        record.status === "Approved"
                          ? "gold"
                          : record.status === "Returned"
                            ? "maroon"
                            : "purple"
                      }
                    >
                      {record.status === "Approved" ? "Verified" : record.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {record.status !== "Approved" || isAdmin ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(record)}
                      >
                        <PencilLine className="size-4" aria-hidden="true" />
                        Edit
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Office correction of a supervisor's register details. */
export function SupervisorRegisterEditor({
  supervisor,
  onClose,
  onDone,
}: {
  supervisor: ResearchSupervisor;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const key = originalSupervisorKey(supervisor);
  const edit = supervisorEditOf(key);
  const [values, setValues] = useState<Record<SupervisorEditField, string>>(() => ({
    name: supervisor.name,
    supervisorId: supervisor.supervisorId,
    department: supervisor.department,
    designation: supervisor.designation,
    researchArea: supervisor.researchArea,
    campus: supervisor.campus,
    phone: supervisor.phone,
    email: supervisor.email,
  }));
  const [onVacancyList, setOnVacancyList] = useState(supervisor.onVacancyList);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const specs: FieldSpec<SupervisorEditField>[] = [
    { name: "name", label: "Name", wide: true },
    { name: "supervisorId", label: "Supervisor ID" },
    {
      name: "designation",
      label: "Designation",
      kind: "select",
      options: researchRegister.supervisors.map((item) => item.designation),
    },
    {
      name: "department",
      label: "Department",
      kind: "select",
      options: researchRegister.supervisors.map((item) => item.department),
    },
    {
      name: "campus",
      label: "Campus",
      kind: "select",
      options: researchRegister.supervisors.map((item) => item.campus),
    },
    { name: "phone", label: "Phone", kind: "tel" },
    { name: "email", label: "Email", kind: "email" },
    { name: "researchArea", label: "Area of research", kind: "textarea", wide: true },
  ];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const saved = await saveSupervisorEdit(key, values, onVacancyList);
    setBusy(false);
    if (!saved.ok) {
      setError("message" in saved ? saved.message : "The details could not be saved.");
      return;
    }
    onDone(`${values.name.trim() || supervisor.name}: register details saved.`);
  }

  return (
    <FormDialog
      title={`Edit supervisor · ${supervisor.name}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Save details"
      size="lg"
    >
      <EditFields
        specs={specs}
        values={values}
        onChange={(name, value) => setValues((current) => ({ ...current, [name]: value }))}
      />
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          className="size-4"
          checked={onVacancyList}
          onChange={(event) => setOnVacancyList(event.target.checked)}
        />
        Show on the public vacancy list
      </label>
      <EditedLine on={edit?.editedOn} by={edit?.editedBy} />
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}
