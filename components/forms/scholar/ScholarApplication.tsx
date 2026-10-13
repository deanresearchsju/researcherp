"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  useForm,
  useWatch,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
} from "react-hook-form";

import { DynamicRows } from "@/components/forms/DynamicRows";
import { FileUpload } from "@/components/forms/FileUpload";
import { WordCountTextarea } from "@/components/forms/WordCountTextarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Stepper } from "@/components/ui/stepper";
import { ApplicationReceipt } from "@/components/forms/scholar/ApplicationReceipt";
import { ApplicationStart } from "@/components/forms/scholar/ApplicationStart";
import { scholarDocuments } from "@/data/documents";
import { scholarDeclaration } from "@/data/declarations";
import { scholarFormCopy } from "@/data/forms";
import { schools } from "@/data/schools";
import { issueScholarNumber, saveSubmission } from "@/lib/applications";
import { attachmentNames, savePhdApplication } from "@/lib/records";
import {
  blankScholar,
  clearLocalDraft,
  clearRemoteDraft,
  findPhdByMobile,
  saveRemoteDraft,
  writeLocalDraft,
  writeLocalReceipt,
  type PhdReceipt,
} from "@/lib/scholar-progress";
import {
  admissionSessions,
  admissionYear,
  applicationFeeInr,
  bloodGroups,
  genders,
  maritalStatuses,
  months,
  paymentModes,
  paymentStatus,
  programmeName,
  studyModes,
  titles,
  referenceDate,
  yesNo,
} from "@/lib/constants";
import {
  ageParts,
  formatAge,
  formatIsoDate,
  formatMonths,
  monthsBetween,
} from "@/lib/dates";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import { fieldMessage, nestedMessage } from "@/lib/form-errors";
import { formatInr } from "@/lib/utils";
import { scholarSchema, type ScholarFormValues } from "@/lib/validation";
const steps = [
  {
    label: "Personal",
    fields: [
      "title",
      "fullName",
      "dateOfBirth",
      "gender",
      "nationality",
      "community",
      "bloodGroup",
      "maritalStatus",
    ],
  },
  { label: "Programme", fields: ["studyMode", "school", "specialization"] },
  { label: "Education", fields: ["ug", "pg", "netQualified", "netMonth", "netYear"] },
  {
    label: "Contact",
    fields: ["email", "mobile", "communication", "sameAddress", "permanent"],
  },
  { label: "Experience", fields: ["experience", "studyMode"] },
  { label: "Research", fields: ["researchArea", "outline"] },
  { label: "Payment", fields: ["paymentMode", "transactionNumber", "paymentDate"] },
  { label: "Documents", fields: [] },
  { label: "Declaration", fields: ["agree", "applicantName"] },
  { label: "Review", fields: [] },
] as const;

type ScholarFiles = Record<(typeof scholarDocuments)[number]["id"], StoredFile | null>;

function emptyFiles(): ScholarFiles {
  return {
    photo: null,
    signature: null,
    dobProof: null,
    ug: null,
    pg: null,
    feeReceipt: null,
    noc: null,
    net: null,
  };
}

function documentRequired(
  spec: (typeof scholarDocuments)[number],
  values: ScholarFormValues,
) {
  if (spec.required === "always") return true;
  if (spec.required === "part-time") return values.studyMode === "Part-Time";
  return false;
}

export function ScholarApplication() {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<ScholarFiles>(emptyFiles);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [receipt, setReceipt] = useState<PhdReceipt | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<ScholarFormValues>({
    resolver: zodResolver(scholarSchema),
    defaultValues: blankScholar(),
    mode: "onSubmit",
  });

  const {
    control,
    register,
    handleSubmit,
    trigger,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  const values = useWatch({ control }) as ScholarFormValues;
  const age = formatAge(ageParts(values.dateOfBirth));

  function persist(nextStep = step) {
    const current = getValues();
    if (!/^[6-9]\d{9}$/.test(current.mobile)) return;
    writeLocalDraft(current.mobile, nextStep, current);
  }

  function isoToday() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  async function beginApplication(start: {
    mobile: string;
    email: string;
    department: string;
  }) {
    const found = await findPhdByMobile(start.mobile);
    if (found.kind === "submitted") {
      setReceipt(found.receipt);
      return;
    }
    const values: ScholarFormValues = {
      ...(found.kind === "draft" ? found.values : blankScholar()),
      mobile: start.mobile,
      email: start.email,
      school: start.department,
      year: admissionYear,
      programme: programmeName,
    };
    const nextStep = found.kind === "draft" ? found.step : 0;
    form.reset(values);
    setStep(nextStep);
    writeLocalDraft(start.mobile, nextStep, values);
    void saveRemoteDraft(start.mobile, start.email, start.department, nextStep, values);
    setEditing(true);
  }

  function setFile(id: keyof ScholarFiles, next: StoredFile | null) {
    setFiles((current) => ({ ...current, [id]: next }));
    setFileErrors((current) => {
      const copy = { ...current };
      delete copy[id];
      return copy;
    });
  }

  function validateFiles(current = getValues()) {
    const next: Record<string, string> = {};
    scholarDocuments.forEach((spec) => {
      const message = fileError(
        files[spec.id]?.file ?? null,
        spec.rule,
        documentRequired(spec, current),
      );
      if (message) next[spec.id] = message;
    });
    setFileErrors(next);
    return Object.keys(next).length === 0;
  }

  async function continueStep() {
    const current = steps[step];
    if (!current) return;
    if (current.label === "Personal") {
      const message = fileError(files.dobProof?.file ?? null, "document", true);
      if (message) {
        setFileErrors((existing) => ({ ...existing, dobProof: message }));
      }
      const ok = await trigger([...current.fields]);
      if (!ok || message) return;
    } else if (current.label === "Documents" || current.label === "Declaration") {
      const filesOk = validateFiles();
      const ok = current.fields.length === 0 ? true : await trigger([...current.fields]);
      if (!ok || !filesOk) return;
      if (current.label === "Documents" && !getValues("applicantName").trim()) {
        setValue("applicantName", getValues("fullName"));
      }
    } else if (current.fields.length > 0) {
      const ok = await trigger([...current.fields]);
      if (!ok) return;
    }
    const nextStep = Math.min(step + 1, steps.length - 1);
    setStep(nextStep);
    persist(nextStep);
    const currentValues = getValues();
    void saveRemoteDraft(
      currentValues.mobile,
      currentValues.email,
      currentValues.school,
      nextStep,
      currentValues,
    );
  }

  function onInvalid(formErrors: FieldErrors<ScholarFormValues>) {
    const keys = Object.keys(formErrors);
    const index = steps.findIndex((item) =>
      item.fields.some((field) => keys.includes(field)),
    );
    if (index >= 0) setStep(index);
  }

  async function onSubmit(submitted: ScholarFormValues) {
    const { phdApplicationsOpen } = await import("@/lib/office");
    if (!phdApplicationsOpen()) {
      setSubmitError("Ph.D. applications are closed.");
      return;
    }
    if (!validateFiles(submitted)) {
      setStep(steps.findIndex((item) => item.label === "Documents"));
      return;
    }
    setSubmitError(null);
    const photo = files.photo?.file
      ? await fileToDataUrl(files.photo.file).catch(() => "")
      : "";
    const signature = files.signature?.file
      ? await fileToDataUrl(files.signature.file).catch(() => "")
      : "";
    const saved = await savePhdApplication({
      dateOfBirth: submitted.dateOfBirth,
      applicantName: submitted.fullName,
      email: submitted.email,
      studyMode: submitted.studyMode,
      payload: {
        ...submitted,
        attachments: attachmentNames(files),
        images: { photo: photo || null, signature: signature || null },
      },
    });
    const applicationNo = saved.ok ? saved.applicationNo : issueScholarNumber();
    const status = "Acknowledgement sent";
    const nextReceipt: PhdReceipt = {
      applicationNo,
      status,
      submittedOn: isoToday(),
      values: submitted,
      attachments: attachmentNames(files),
      photo: photo || null,
      signature: signature || null,
    };
    saveSubmission({
      applicationNo,
      dateOfBirth: submitted.dateOfBirth,
      name: submitted.fullName,
      email: submitted.email,
      status,
    });
    writeLocalReceipt(submitted.mobile, nextReceipt);
    clearLocalDraft(submitted.mobile);
    void clearRemoteDraft(submitted.mobile);
    setReceipt(nextReceipt);
    setEditing(false);
  }

  if (receipt) {
    return <ApplicationReceipt receipt={receipt} />;
  }

  if (!editing) {
    return <ApplicationStart onApply={beginApplication} />;
  }

  const current = steps[step];

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      onChange={() => persist()}
      noValidate
    >
      <header className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-heading text-2xl text-primary">
              {scholarFormCopy.university}
            </p>
            <p className="text-sm text-muted-foreground">{scholarFormCopy.unit}</p>
            <h1 className="mt-2 text-lg font-semibold tracking-wide text-secondary">
              {scholarFormCopy.title}
            </h1>
          </div>
          <div className="w-full max-w-56">
            <div className="relative mx-auto mb-2 aspect-[7/9] w-36 overflow-hidden rounded-xl border border-dashed border-primary/30 bg-white">
              {files.photo?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={files.photo.previewUrl}
                  alt="Passport photograph preview"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <span className="grid h-full place-items-center px-3 text-center text-xs text-muted-foreground">
                  {scholarFormCopy.photoLabel}
                </span>
              )}
            </div>
            <FileUpload
              id="photo-header"
              acceptRule="photo"
              framed
              value={files.photo}
              error={fileErrors.photo}
              onChange={(next) => setFile("photo", next)}
            />
          </div>
        </div>
        <fieldset className="mt-5 rounded-xl border border-border p-4" disabled>
          <legend className="px-1 text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
            {scholarFormCopy.officeTitle}
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label={scholarFormCopy.applicationNo} htmlFor="office-no">
              <Input id="office-no" readOnly value={scholarFormCopy.issued} />
            </FormField>
            <FormField label={scholarFormCopy.applicationDate} htmlFor="office-date">
              <Input id="office-date" readOnly value={formatIsoDate(referenceDate)} />
            </FormField>
          </div>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            label={scholarFormCopy.session}
            htmlFor="session"
            required
            error={errors.session?.message}
          >
            <NativeSelect id="session" {...register("session")}>
              {admissionSessions.map((session) => (
                <option key={session} value={session}>
                  {session} {admissionYear}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </header>

      <Stepper steps={steps.map((item) => item.label)} current={step} />

      {current?.label === "Personal" ? (
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-card sm:grid-cols-2">
          <h2 className="font-heading text-2xl text-primary sm:col-span-2">
            1. Personal Details
          </h2>
          <SelectField
            id="title"
            label="Title (Mr/Ms/Mrs/Dr)"
            register={register}
            name="title"
            error={errors.title?.message}
            options={titles}
          />
          <FormField
            label="Full Name"
            htmlFor="fullName"
            required
            error={errors.fullName?.message}
          >
            <Input id="fullName" autoComplete="name" {...register("fullName")} />
          </FormField>
          <FormField
            label="Date of Birth"
            htmlFor="dateOfBirth"
            required
            error={errors.dateOfBirth?.message}
          >
            <Input
              id="dateOfBirth"
              type="date"
              max={referenceDate}
              autoComplete="bday"
              {...register("dateOfBirth")}
            />
          </FormField>
          <FormField label="DOB proof" htmlFor="dobProof" required>
            <FileUpload
              id="dobProof"
              acceptRule="document"
              value={files.dobProof}
              error={fileErrors.dobProof}
              onChange={(next) => setFile("dobProof", next)}
            />
          </FormField>
          <SelectField
            id="gender"
            label="Gender"
            register={register}
            name="gender"
            error={errors.gender?.message}
            options={genders}
          />
          <FormField
            label="Nationality"
            htmlFor="nationality"
            required
            error={errors.nationality?.message}
          >
            <Input id="nationality" {...register("nationality")} />
          </FormField>
          <FormField
            label="Community"
            htmlFor="community"
            required
            error={errors.community?.message}
          >
            <Input id="community" {...register("community")} />
          </FormField>
          <SelectField
            id="bloodGroup"
            label="Blood Group"
            register={register}
            name="bloodGroup"
            error={errors.bloodGroup?.message}
            options={bloodGroups}
          />
          <SelectField
            id="maritalStatus"
            label="Marital Status"
            register={register}
            name="maritalStatus"
            error={errors.maritalStatus?.message}
            options={maritalStatuses}
          />
        </section>
      ) : null}

      {current?.label === "Programme" ? (
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-card sm:grid-cols-2">
          <h2 className="font-heading text-2xl text-primary sm:col-span-2">
            2. Programme Details
          </h2>
          <FormField label="Programme" htmlFor="programme">
            <Input id="programme" readOnly value={programmeName} />
          </FormField>
          <SelectField
            id="studyMode"
            label="Study Mode (Full-Time / Part-Time)"
            register={register}
            name="studyMode"
            error={errors.studyMode?.message}
            options={studyModes}
          />
          <FormField
            label="School / Department"
            htmlFor="school"
            required
            error={errors.school?.message}
          >
            <NativeSelect id="school" {...register("school")}>
              <option value="">Select</option>
              {schools.map((school) => (
                <option key={school.id} value={school.name}>
                  {school.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Specialization"
            htmlFor="specialization"
            required
            error={errors.specialization?.message}
          >
            <Input id="specialization" {...register("specialization")} />
          </FormField>
        </section>
      ) : null}

      {current?.label === "Education" ? (
        <section className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">3. Education Details</h2>
          <EducationBlock title="UG" prefix="ug" register={register} errors={errors} />
          <EducationBlock title="PG" prefix="pg" register={register} errors={errors} />
          <SelectField
            id="netQualified"
            label="Qualified in NET?"
            register={register}
            name="netQualified"
            error={errors.netQualified?.message}
            options={yesNo}
          />
          {values.netQualified === "Yes" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                id="netMonth"
                label="Month of passing"
                register={register}
                name="netMonth"
                error={errors.netMonth?.message}
                options={months}
              />
              <FormField
                label="Year of passing"
                htmlFor="netYear"
                required
                error={errors.netYear?.message}
              >
                <Input id="netYear" inputMode="numeric" {...register("netYear")} />
              </FormField>
            </div>
          ) : null}
        </section>
      ) : null}

      {current?.label === "Contact" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">4. Contact Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Email Address"
              htmlFor="email"
              required
              error={errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
            </FormField>
            <FormField
              label="Mobile Number"
              htmlFor="mobile"
              required
              error={errors.mobile?.message}
            >
              <Input
                id="mobile"
                inputMode="numeric"
                autoComplete="tel"
                {...register("mobile")}
              />
            </FormField>
          </div>
          <h3 className="font-semibold text-primary">Address for Communication</h3>
          <AddressFields prefix="communication" register={register} errors={errors} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              {...register("sameAddress")}
            />
            Permanent address same as above
          </label>
          {values.sameAddress ? null : (
            <div className="space-y-3">
              <h3 className="font-semibold text-primary">Permanent Address</h3>
              <AddressFields prefix="permanent" register={register} errors={errors} />
            </div>
          )}
        </section>
      ) : null}

      {current?.label === "Experience" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">5. Work Experience</h2>
          {fieldMessage(errors.experience) ? (
            <p role="alert" className="text-sm text-secondary">
              {fieldMessage(errors.experience)}
            </p>
          ) : null}
          <DynamicRows
            addLabel="Add a row"
            onAdd={() =>
              setValue("experience", [
                ...getValues("experience"),
                { organization: "", designation: "", from: "", to: "" },
              ])
            }
          >
            {values.experience.map((row, index) => (
              <div
                key={`exp-${index}`}
                className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2"
              >
                <p className="text-sm font-semibold text-primary sm:col-span-2">
                  S.No. {index + 1}
                </p>
                <FormField
                  label="Organization / Institution"
                  htmlFor={`org-${index}`}
                  error={nestedMessage(errors, `experience.${index}.organization`)}
                >
                  <Input
                    id={`org-${index}`}
                    {...register(`experience.${index}.organization`)}
                  />
                </FormField>
                <FormField
                  label="Designation"
                  htmlFor={`des-${index}`}
                  error={nestedMessage(errors, `experience.${index}.designation`)}
                >
                  <Input
                    id={`des-${index}`}
                    {...register(`experience.${index}.designation`)}
                  />
                </FormField>
                <FormField
                  label="From"
                  htmlFor={`from-${index}`}
                  error={nestedMessage(errors, `experience.${index}.from`)}
                >
                  <Input
                    id={`from-${index}`}
                    type="date"
                    {...register(`experience.${index}.from`)}
                  />
                </FormField>
                <FormField
                  label="To"
                  htmlFor={`to-${index}`}
                  error={nestedMessage(errors, `experience.${index}.to`)}
                >
                  <Input
                    id={`to-${index}`}
                    type="date"
                    {...register(`experience.${index}.to`)}
                  />
                </FormField>
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  Total Exp. {formatMonths(monthsBetween(row.from, row.to))}
                </p>
                {values.experience.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setValue(
                        "experience",
                        getValues("experience").filter(
                          (_, rowIndex) => rowIndex !== index,
                        ),
                      )
                    }
                  >
                    Remove row
                  </Button>
                ) : null}
              </div>
            ))}
          </DynamicRows>
        </section>
      ) : null}

      {current?.label === "Research" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">6. Proposed Research</h2>
          <FormField
            label="Proposed Area of Research"
            htmlFor="researchArea"
            required
            error={errors.researchArea?.message}
          >
            <Input id="researchArea" {...register("researchArea")} />
          </FormField>
          <FormField
            label="Brief Outline of Proposed Research (150–200 words)"
            htmlFor="outline"
            required
            error={errors.outline?.message}
          >
            <WordCountTextarea
              id="outline"
              value={values.outline}
              invalid={Boolean(errors.outline)}
              onChange={(next) => setValue("outline", next, { shouldDirty: true })}
            />
          </FormField>
        </section>
      ) : null}

      {current?.label === "Payment" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">7. Payment Details</h2>
          <div className="rounded-xl bg-muted p-4 text-sm leading-6">
            <p className="font-semibold text-primary">
              Application fee ₹{formatInr(applicationFeeInr)}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="paymentMode"
              label="Mode"
              register={register}
              name="paymentMode"
              error={errors.paymentMode?.message}
              options={paymentModes}
            />
            <FormField
              label="Transaction Number"
              htmlFor="transactionNumber"
              required
              error={errors.transactionNumber?.message}
            >
              <Input id="transactionNumber" {...register("transactionNumber")} />
            </FormField>
            <FormField
              label="Date of Payment"
              htmlFor="paymentDate"
              required
              error={errors.paymentDate?.message}
            >
              <Input
                id="paymentDate"
                type="date"
                max={referenceDate}
                {...register("paymentDate")}
              />
            </FormField>
            <FormField label="Amount" htmlFor="amount">
              <Input id="amount" readOnly value={`₹${formatInr(applicationFeeInr)}`} />
            </FormField>
            <FormField label="Status" htmlFor="pay-status">
              <Input id="pay-status" readOnly value={paymentStatus} />
            </FormField>
          </div>
        </section>
      ) : null}

      {current?.label === "Documents" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">8. Document Checklist</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-semibold">Document</th>
                  <th className="py-2 pr-3 font-semibold">Uploaded (Y/N)</th>
                  <th className="py-2 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {scholarDocuments.map((spec) => {
                  const required = documentRequired(spec, values);
                  const uploaded = Boolean(files[spec.id]);
                  return (
                    <tr key={spec.id} className="border-b border-border align-top">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-primary">
                          {spec.label}
                          {required ? " *" : " (optional)"}
                        </p>
                        <div className="mt-2">
                          <FileUpload
                            id={`doc-${spec.id}`}
                            acceptRule={spec.rule}
                            value={files[spec.id]}
                            error={fileErrors[spec.id]}
                            onChange={(next) => setFile(spec.id, next)}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-semibold">{uploaded ? "Y" : "N"}</td>
                      <td className="py-3 text-muted-foreground">{spec.remarks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {current?.label === "Declaration" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">9. Declaration</h2>
          <p className="text-sm leading-6 text-foreground">{scholarDeclaration}</p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              {...register("agree")}
            />
            I agree
          </label>
          {errors.agree?.message ? (
            <p role="alert" className="text-sm text-secondary">
              {errors.agree.message}
            </p>
          ) : null}
          <FormField
            label="Applicant Name"
            htmlFor="applicantName"
            required
            error={errors.applicantName?.message}
          >
            <Input id="applicantName" {...register("applicantName")} />
          </FormField>
          <FormField
            label="Signature"
            htmlFor="declaration-signature"
            required
            error={fileErrors.signature}
          >
            <FileUpload
              id="declaration-signature"
              acceptRule="scholarSignature"
              value={files.signature}
              onChange={(next) => setFile("signature", next)}
            />
            {files.signature?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={files.signature.previewUrl}
                alt="Signature preview"
                className="mt-2 h-16 w-auto"
              />
            ) : null}
          </FormField>
          <FormField label="Date" htmlFor="declaration-date">
            <Input id="declaration-date" readOnly value={formatIsoDate(referenceDate)} />
          </FormField>
        </section>
      ) : null}

      {current?.label === "Review" ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-card text-sm">
          <h2 className="font-heading text-2xl text-primary">Review</h2>
          <ReviewLine label="Name" value={`${values.title} ${values.fullName}`.trim()} />
          <ReviewLine
            label="Date of birth"
            value={`${formatIsoDate(values.dateOfBirth)} (${age || "age pending"})`}
          />
          <ReviewLine
            label="Programme"
            value={`${values.programme} · ${values.studyMode} · ${values.school}`}
          />
          <ReviewLine label="Specialization" value={values.specialization} />
          <ReviewLine label="Email" value={values.email} />
          <ReviewLine label="Mobile" value={values.mobile} />
          <ReviewLine label="Research area" value={values.researchArea} />
          <ReviewLine
            label="Payment"
            value={`${values.paymentMode} · ${values.transactionNumber} · ${paymentStatus}`}
          />
          <ReviewLine
            label="Documents"
            value={scholarDocuments
              .map((spec) => `${spec.label}: ${files[spec.id] ? "Y" : "N"}`)
              .join(" · ")}
          />
        </section>
      ) : null}

      {submitError ? (
        <p role="alert" className="text-sm text-secondary">
          {submitError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((value) => value - 1)}
          >
            Back
          </Button>
        ) : null}
        {current?.label === "Review" ? (
          <Button type="submit" variant="gold" disabled={isSubmitting}>
            Submit application
          </Button>
        ) : (
          <Button type="button" variant="gold" onClick={() => void continueStep()}>
            Continue
          </Button>
        )}
      </div>
    </form>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold text-primary">{label}. </span>
      <span className="text-muted-foreground">{value || "—"}</span>
    </p>
  );
}

function SelectField({
  id,
  label,
  name,
  options,
  error,
  register,
}: {
  id: string;
  label: string;
  name: FieldPath<ScholarFormValues>;
  options: readonly string[];
  error?: string;
  register: UseFormRegister<ScholarFormValues>;
}) {
  return (
    <FormField label={label} htmlFor={id} required error={error}>
      <NativeSelect id={id} {...register(name)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );
}

function AddressFields({
  prefix,
  register,
  errors,
}: {
  prefix: "communication" | "permanent";
  register: UseFormRegister<ScholarFormValues>;
  errors: FieldErrors<ScholarFormValues>;
}) {
  const fields = [
    ["door", "Door No"],
    ["street", "Street"],
    ["city", "City"],
    ["district", "District"],
    ["state", "State"],
    ["pin", prefix === "communication" ? "Pin Code" : "Pin code"],
    ["country", "Country"],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map(([key, label]) => (
        <FormField
          key={key}
          label={label}
          htmlFor={`${prefix}-${key}`}
          required
          error={nestedMessage(errors, `${prefix}.${key}`)}
        >
          <Input id={`${prefix}-${key}`} {...register(`${prefix}.${key}`)} />
        </FormField>
      ))}
    </div>
  );
}

function EducationBlock({
  title,
  prefix,
  register,
  errors,
}: {
  title: string;
  prefix: "ug" | "pg";
  register: UseFormRegister<ScholarFormValues>;
  errors: FieldErrors<ScholarFormValues>;
}) {
  const fields = [
    ["degree", "Degree"],
    ["specialisation", "Specialisation"],
    ["institution", "Institution Name"],
    ["university", "University"],
    ["year", "Year of Passing"],
    ["score", "% / CGPA"],
  ] as const;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-primary">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label]) => (
          <FormField
            key={key}
            label={label}
            htmlFor={`${prefix}-${key}`}
            required
            error={nestedMessage(errors, `${prefix}.${key}`)}
          >
            <Input id={`${prefix}-${key}`} {...register(`${prefix}.${key}`)} />
          </FormField>
        ))}
      </div>
    </div>
  );
}
