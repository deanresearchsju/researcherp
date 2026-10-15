"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useSyncExternalStore } from "react";
import {
  useForm,
  useWatch,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
} from "react-hook-form";

import { DynamicRows } from "@/components/forms/DynamicRows";
import { FileUpload } from "@/components/forms/FileUpload";
import {
  SupervisorReceiptView,
  type SupervisorReceipt,
} from "@/components/forms/supervisor/SupervisorReceipt";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Stepper } from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import { ApplicationsClosed } from "@/components/forms/ApplicationsClosed";
import { supervisorEnclosures } from "@/data/documents";
import { supervisorDeclaration } from "@/data/declarations";
import { supervisorFormCopy } from "@/data/forms";
import { currentOffice, subscribeOffice, supervisorApplicationsOpen } from "@/lib/office";
import {
  attachmentFiles,
  attachmentNames,
  saveSupervisorApplication,
} from "@/lib/records";
import {
  indexingOptions,
  months,
  referenceDate,
  retirementAge,
  sexes,
  storageKeys,
  university,
  yesNo,
} from "@/lib/constants";
import {
  ageParts,
  formatAge,
  formatIsoDate,
  serviceUntilAge,
  sumDuration,
} from "@/lib/dates";
import { fileError, fileToDataUrl, type StoredFile } from "@/lib/files";
import { fieldMessage, nestedMessage } from "@/lib/form-errors";
import {
  emptyAddress,
  emptyPublication,
  emptyQualification,
  supervisorSchema,
  type SupervisorFormValues,
} from "@/lib/validation";

const steps = [
  {
    label: "Personal",
    fields: [
      "name",
      "designation",
      "department",
      "sex",
      "dateOfBirth",
      "religion",
      "community",
      "state",
      "nationality",
    ],
  },
  {
    label: "Address",
    fields: ["permanent", "sameAddress", "communication", "phone", "email"],
  },
  {
    label: "Qualification",
    fields: [
      "postgraduate",
      "mphil",
      "phd",
      "phdAwardYear",
      "dlitt",
      "faculty",
      "subject",
      "expertise",
    ],
  },
  { label: "Service", fields: ["appointmentDate"] },
  { label: "Publications", fields: ["publications"] },
  {
    label: "Experience",
    fields: [
      "preYears",
      "preMonths",
      "postYears",
      "postMonths",
      "researchYears",
      "researchMonths",
    ],
  },
  {
    label: "Proposal",
    fields: [
      "proposedDepartment",
      "recognisedElsewhere",
      "recognitionDetails",
      "otherInformation",
    ],
  },
  { label: "Enclosures", fields: [] },
  { label: "Declaration", fields: ["place", "agree"] },
  { label: "Review", fields: [] },
] as const;

type EnclosureId = (typeof supervisorEnclosures)[number]["id"];

function emptySupervisor(): SupervisorFormValues {
  return {
    name: "",
    designation: "",
    department: "",
    sex: "",
    dateOfBirth: "",
    religion: "",
    community: "",
    state: "",
    nationality: "Indian",
    permanent: emptyAddress(),
    sameAddress: true,
    communication: emptyAddress(),
    phone: "",
    email: "",
    postgraduate: emptyQualification(),
    mphil: emptyQualification(),
    phd: emptyQualification(),
    phdAwardYear: "",
    dlitt: emptyQualification(),
    faculty: "",
    subject: "",
    expertise: "",
    appointmentDate: "",
    publications: Array.from({ length: 5 }, (_, index) =>
      emptyPublication(`pub-${index + 1}`),
    ),
    preYears: "",
    preMonths: "",
    postYears: "",
    postMonths: "",
    researchYears: "",
    researchMonths: "",
    proposedDepartment: "",
    recognisedElsewhere: "",
    recognitionDetails: "",
    otherInformation: "",
    place: "",
    agree: false,
  };
}

function loadDraft(): SupervisorFormValues {
  const empty = emptySupervisor();
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(storageKeys.supervisorDraft);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<SupervisorFormValues>;
    return {
      ...empty,
      ...parsed,
      permanent: { ...empty.permanent, ...parsed.permanent },
      communication: { ...empty.communication, ...parsed.communication },
      postgraduate: { ...empty.postgraduate, ...parsed.postgraduate },
      mphil: { ...empty.mphil, ...parsed.mphil },
      phd: { ...empty.phd, ...parsed.phd },
      dlitt: { ...empty.dlitt, ...parsed.dlitt },
      publications:
        parsed.publications && parsed.publications.length >= 5
          ? parsed.publications
          : empty.publications,
      sameAddress: parsed.sameAddress !== false,
      agree: Boolean(parsed.agree),
    };
  } catch {
    return empty;
  }
}

export function SupervisorApplication() {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<Record<EnclosureId, StoredFile | null>>({
    photo: null,
    signature: null,
    sslc: null,
    appointment: null,
    ug: null,
    pg: null,
    phd: null,
    resume: null,
  });
  const [papers, setPapers] = useState<Record<string, StoredFile | null>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [issued, setIssued] = useState<SupervisorReceipt | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);

  const form = useForm<SupervisorFormValues>({
    resolver: zodResolver(supervisorSchema),
    defaultValues: loadDraft(),
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

  const values = useWatch({ control }) as SupervisorFormValues;
  const age = formatAge(ageParts(values.dateOfBirth));

  function persist() {
    window.localStorage.setItem(storageKeys.supervisorDraft, JSON.stringify(getValues()));
  }
  const remaining = serviceUntilAge(values.dateOfBirth, retirementAge);
  const teaching = sumDuration(
    values.preYears,
    values.preMonths,
    values.postYears,
    values.postMonths,
  );
  const nameField = register("name");

  function setEnclosure(id: EnclosureId, next: StoredFile | null) {
    setFiles((current) => ({ ...current, [id]: next }));
    setFileErrors((current) => {
      const copy = { ...current };
      delete copy[id];
      return copy;
    });
  }

  function validateEnclosures() {
    const next: Record<string, string> = {};
    supervisorEnclosures.forEach((spec) => {
      const message = fileError(files[spec.id]?.file ?? null, spec.rule, true);
      if (message) next[spec.id] = message;
    });
    values.publications.forEach((row) => {
      const message = fileError(papers[row.id]?.file ?? null, "document", true);
      if (message) next[row.id] = message;
    });
    setFileErrors(next);
    return Object.keys(next).length === 0;
  }

  async function continueStep() {
    const current = steps[step];
    if (!current) return;
    if (current.label === "Personal") {
      const message = fileError(files.sslc?.file ?? null, "document", true);
      setFileErrors((existing) => {
        const copy = { ...existing };
        if (message) copy.sslc = message;
        else delete copy.sslc;
        return copy;
      });
      const ok = await trigger([...current.fields]);
      if (!ok || message) return;
    } else if (current.label === "Publications") {
      const ok = await trigger([...current.fields]);
      const filesOk = values.publications.every((row) => {
        const message = fileError(papers[row.id]?.file ?? null, "document", true);
        return !message;
      });
      if (!filesOk) {
        const next = { ...fileErrors };
        values.publications.forEach((row) => {
          const message = fileError(papers[row.id]?.file ?? null, "document", true);
          if (message) next[row.id] = message;
        });
        setFileErrors(next);
      }
      if (!ok || !filesOk) return;
    } else if (current.label === "Enclosures" || current.label === "Declaration") {
      const filesOk = validateEnclosures();
      const ok = current.fields.length === 0 ? true : await trigger([...current.fields]);
      if (!ok || !filesOk) return;
    } else if (current.fields.length > 0) {
      const ok = await trigger([...current.fields]);
      if (!ok) return;
    }
    if (current.label === "Address" && getValues("sameAddress")) {
      setValue("communication", getValues("permanent"));
    }
    setStep((value) => Math.min(value + 1, steps.length - 1));
    persist();
  }

  function onInvalid(formErrors: FieldErrors<SupervisorFormValues>) {
    const keys = Object.keys(formErrors);
    const index = steps.findIndex((item) =>
      item.fields.some((field) => keys.includes(field)),
    );
    if (index >= 0) setStep(index);
  }

  async function onSubmit(submitted: SupervisorFormValues) {
    if (!supervisorApplicationsOpen()) {
      setSubmitError("Supervisor recognition applications are closed.");
      return;
    }
    if (!validateEnclosures()) {
      setStep(steps.findIndex((item) => item.label === "Enclosures"));
      return;
    }
    setSubmitError(null);
    const photo = files.photo?.file
      ? await fileToDataUrl(files.photo.file).catch(() => "")
      : "";
    const signature = files.signature?.file
      ? await fileToDataUrl(files.signature.file).catch(() => "")
      : "";
    const now = new Date();
    const submittedOn = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const saved = await saveSupervisorApplication({
      dateOfBirth: submitted.dateOfBirth,
      applicantName: submitted.name,
      email: submitted.email,
      payload: {
        ...submitted,
        attachments: attachmentNames(files),
        papers: attachmentNames(papers),
        files: await attachmentFiles({ ...files, ...papers }),
        images: { photo: photo || null, signature: signature || null },
      },
    });
    if (!saved.ok) {
      setSubmitError(saved.message);
      return;
    }
    window.localStorage.removeItem(storageKeys.supervisorDraft);
    setIssued({
      applicationNo: saved.applicationNo,
      submittedOn,
      values: submitted,
      photo: photo || null,
      signature: signature || null,
      attachments: attachmentNames(files),
    });
  }

  if (issued) {
    return <SupervisorReceiptView receipt={issued} />;
  }

  if (office && !office.settings.supervisorOpen) {
    return (
      <ApplicationsClosed
        title="Supervisor applications are closed"
        detail="The research office has closed recognition applications."
      />
    );
  }

  const current = steps[step];

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      onChange={persist}
      noValidate
    >
      <header className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:justify-between">
          <div>
            <p className="font-heading text-2xl text-primary">St. JOSEPH UNIVERSITY</p>
            <p className="text-sm text-muted-foreground">{university.unit}</p>
            <h1 className="mt-2 text-lg font-semibold text-secondary">
              {supervisorFormCopy.title}
            </h1>
          </div>
          <div className="w-full max-w-56">
            <div className="relative mx-auto mb-2 aspect-[7/9] w-36 overflow-hidden rounded-xl border border-dashed border-primary/30 bg-white">
              {files.photo?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={files.photo.previewUrl}
                  alt="Photograph preview"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <span className="grid h-full place-items-center px-3 text-center text-xs text-muted-foreground">
                  {supervisorFormCopy.photoLabel}
                </span>
              )}
            </div>
            <FileUpload
              id="sup-photo"
              acceptRule="photo"
              framed
              value={files.photo}
              error={fileErrors.photo}
              onChange={(next) => setEnclosure("photo", next)}
            />
          </div>
        </div>
      </header>
      <Stepper steps={steps.map((item) => item.label)} current={step} />

      {current?.label === "Personal" ? (
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-card sm:grid-cols-2">
          <h2 className="font-heading text-2xl text-primary sm:col-span-2">Applicant</h2>
          <FormField
            label="Name of the Applicant (in English — block letters)"
            htmlFor="name"
            required
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input
              id="name"
              className="uppercase"
              {...nameField}
              onChange={(event) => {
                event.target.value = event.target.value.toUpperCase();
                void nameField.onChange(event);
              }}
            />
          </FormField>
          <FormField
            label="Designation"
            htmlFor="designation"
            required
            error={errors.designation?.message}
          >
            <Input id="designation" {...register("designation")} />
          </FormField>
          <FormField
            label="Department"
            htmlFor="department"
            required
            error={errors.department?.message}
          >
            <Input id="department" {...register("department")} />
          </FormField>
          <SelectField
            id="sex"
            label="Sex"
            name="sex"
            options={sexes}
            error={errors.sex?.message}
            register={register}
          />
          <FormField
            label="Date of Birth"
            htmlFor="sup-dob"
            required
            error={errors.dateOfBirth?.message}
          >
            <Input
              id="sup-dob"
              type="date"
              max={referenceDate}
              {...register("dateOfBirth")}
            />
          </FormField>
          <FormField
            label="Copy of SSLC Certificate (date of birth)"
            htmlFor="sslc"
            required
            className="sm:col-span-2"
          >
            <FileUpload
              id="sslc"
              acceptRule="document"
              value={files.sslc}
              error={fileErrors.sslc}
              onChange={(next) => setEnclosure("sslc", next)}
            />
          </FormField>
          <FormField
            label="Religion"
            htmlFor="religion"
            required
            error={errors.religion?.message}
          >
            <Input id="religion" {...register("religion")} />
          </FormField>
          <FormField
            label="Community"
            htmlFor="sup-community"
            required
            error={errors.community?.message}
          >
            <Input id="sup-community" {...register("community")} />
          </FormField>
          <FormField
            label="State"
            htmlFor="sup-state"
            required
            error={errors.state?.message}
          >
            <Input id="sup-state" {...register("state")} />
          </FormField>
          <FormField
            label="Nationality"
            htmlFor="sup-nationality"
            required
            error={errors.nationality?.message}
          >
            <Input id="sup-nationality" {...register("nationality")} />
          </FormField>
        </section>
      ) : null}

      {current?.label === "Address" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">Address and contact</h2>
          <h3 className="font-semibold text-primary">Permanent Address</h3>
          <AddressFields prefix="permanent" register={register} errors={errors} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              {...register("sameAddress")}
            />
            Address for communication is the same as the permanent address
          </label>
          {values.sameAddress ? null : (
            <>
              <h3 className="font-semibold text-primary">Address for Communication</h3>
              <AddressFields prefix="communication" register={register} errors={errors} />
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Contact No."
              htmlFor="phone"
              required
              error={errors.phone?.message}
            >
              <Input id="phone" inputMode="numeric" {...register("phone")} />
            </FormField>
            <FormField
              label="e-mail ID"
              htmlFor="sup-email"
              required
              error={errors.email?.message}
            >
              <Input id="sup-email" type="email" {...register("email")} />
            </FormField>
          </div>
        </section>
      ) : null}

      {current?.label === "Qualification" ? (
        <section className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">Academic Qualification</h2>
          <QualBlock
            title="Post Graduate"
            prefix="postgraduate"
            register={register}
            errors={errors}
          />
          <QualBlock
            title="M.Phil."
            prefix="mphil"
            register={register}
            errors={errors}
            optional
          />
          <QualBlock title="Ph.D." prefix="phd" register={register} errors={errors} />
          <FormField
            label="Year of Award"
            htmlFor="phdAwardYear"
            required
            error={errors.phdAwardYear?.message}
          >
            <Input id="phdAwardYear" inputMode="numeric" {...register("phdAwardYear")} />
          </FormField>
          <QualBlock
            title="D.Litt."
            prefix="dlitt"
            register={register}
            errors={errors}
            optional
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Faculty"
              htmlFor="faculty"
              required
              error={errors.faculty?.message}
            >
              <Input id="faculty" {...register("faculty")} />
            </FormField>
            <FormField
              label="Subject"
              htmlFor="subject"
              required
              error={errors.subject?.message}
            >
              <Input id="subject" {...register("subject")} />
            </FormField>
            <FormField
              label="Area of Expertise"
              htmlFor="expertise"
              required
              error={errors.expertise?.message}
            >
              <Input id="expertise" {...register("expertise")} />
            </FormField>
          </div>
        </section>
      ) : null}

      {current?.label === "Service" ? (
        <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-card sm:grid-cols-2">
          <h2 className="font-heading text-2xl text-primary sm:col-span-2">
            Appointment
          </h2>
          <FormField
            label="Date of Appointment at St. Joseph University"
            htmlFor="appointmentDate"
            required
            error={errors.appointmentDate?.message}
          >
            <Input id="appointmentDate" type="date" {...register("appointmentDate")} />
          </FormField>
          <FormField
            label="Remaining Period of Service (up to 70 years)"
            htmlFor="remaining"
          >
            <Input
              id="remaining"
              readOnly
              value={remaining ? formatAge(remaining) : ""}
            />
          </FormField>
        </section>
      ) : null}

      {current?.label === "Publications" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">Research Publications</h2>
          {fieldMessage(errors.publications) ? (
            <p role="alert" className="text-sm text-secondary">
              {fieldMessage(errors.publications)}
            </p>
          ) : null}
          <DynamicRows
            addLabel="Add a publication"
            onAdd={() =>
              setValue("publications", [
                ...getValues("publications"),
                emptyPublication(`pub-${getValues("publications").length + 1}`),
              ])
            }
          >
            {values.publications.map((row, index) => (
              <div
                key={row.id}
                className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2"
              >
                <p className="text-sm font-semibold text-primary sm:col-span-2">
                  {index + 1}
                </p>
                <FormField
                  label="Title"
                  htmlFor={`title-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.title`)}
                  className="sm:col-span-2"
                >
                  <Input
                    id={`title-${row.id}`}
                    {...register(`publications.${index}.title`)}
                  />
                </FormField>
                <FormField
                  label="Journal Name"
                  htmlFor={`journal-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.journal`)}
                >
                  <Input
                    id={`journal-${row.id}`}
                    {...register(`publications.${index}.journal`)}
                  />
                </FormField>
                <FormField
                  label="DOI"
                  htmlFor={`doi-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.doi`)}
                >
                  <Input
                    id={`doi-${row.id}`}
                    {...register(`publications.${index}.doi`)}
                  />
                </FormField>
                <FormField
                  label="Year"
                  htmlFor={`year-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.year`)}
                >
                  <Input
                    id={`year-${row.id}`}
                    inputMode="numeric"
                    {...register(`publications.${index}.year`)}
                  />
                </FormField>
                <FormField
                  label="Month"
                  htmlFor={`month-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.month`)}
                >
                  <NativeSelect
                    id={`month-${row.id}`}
                    {...register(`publications.${index}.month`)}
                  >
                    <option value="">Select</option>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  label="URL of the published paper"
                  htmlFor={`url-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.url`)}
                >
                  <Input
                    id={`url-${row.id}`}
                    {...register(`publications.${index}.url`)}
                  />
                </FormField>
                <FormField
                  label="Page number"
                  htmlFor={`pages-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.pages`)}
                >
                  <Input
                    id={`pages-${row.id}`}
                    {...register(`publications.${index}.pages`)}
                  />
                </FormField>
                <FormField
                  label="Indexing"
                  htmlFor={`index-${row.id}`}
                  error={nestedMessage(errors, `publications.${index}.indexing`)}
                >
                  <NativeSelect
                    id={`index-${row.id}`}
                    {...register(`publications.${index}.indexing`)}
                  >
                    <option value="">Select</option>
                    {indexingOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField
                  label="First page of the paper"
                  htmlFor={`paper-${row.id}`}
                  className="sm:col-span-2"
                >
                  <FileUpload
                    id={`paper-${row.id}`}
                    acceptRule="document"
                    value={papers[row.id] ?? null}
                    error={fileErrors[row.id]}
                    onChange={(next) => {
                      setPapers((currentPapers) => ({
                        ...currentPapers,
                        [row.id]: next,
                      }));
                      setFileErrors((currentErrors) => {
                        const copy = { ...currentErrors };
                        delete copy[row.id];
                        return copy;
                      });
                    }}
                  />
                </FormField>
                {values.publications.length > 5 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setValue(
                        "publications",
                        getValues("publications").filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </DynamicRows>
        </section>
      ) : null}

      {current?.label === "Experience" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">
            Teaching and research experience
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DurationFields
              label="Pre-doctoral"
              years="preYears"
              months="preMonths"
              register={register}
              errors={errors}
            />
            <DurationFields
              label="Post-doctoral"
              years="postYears"
              months="postMonths"
              register={register}
              errors={errors}
            />
          </div>
          <FormField label="Total" htmlFor="teaching-total">
            <Input id="teaching-total" readOnly value={formatAge(teaching)} />
          </FormField>
          <h3 className="font-semibold text-primary">
            Research Experience (Post Doctoral)
          </h3>
          <DurationFields
            label="Post-doctoral research"
            years="researchYears"
            months="researchMonths"
            register={register}
            errors={errors}
          />
        </section>
      ) : null}

      {current?.label === "Proposal" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">Proposed guideship</h2>
          <FormField
            label="Name of the Department where the applicant proposes to work as a research guide"
            htmlFor="proposedDepartment"
            required
            error={errors.proposedDepartment?.message}
          >
            <Input id="proposedDepartment" {...register("proposedDepartment")} />
          </FormField>
          <SelectField
            id="recognisedElsewhere"
            label="Recognised as a research guide by any other University/Institute in India or abroad?"
            name="recognisedElsewhere"
            options={yesNo}
            error={errors.recognisedElsewhere?.message}
            register={register}
          />
          {values.recognisedElsewhere === "Yes" ? (
            <FormField
              label="Details"
              htmlFor="recognitionDetails"
              required
              error={errors.recognitionDetails?.message}
            >
              <Textarea id="recognitionDetails" {...register("recognitionDetails")} />
            </FormField>
          ) : null}
          <FormField label="Any other relevant information" htmlFor="otherInformation">
            <Textarea id="otherInformation" {...register("otherInformation")} />
          </FormField>
        </section>
      ) : null}

      {current?.label === "Enclosures" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">Enclosures</h2>
          {supervisorEnclosures.map((spec) => (
            <FormField
              key={spec.id}
              label={spec.label}
              htmlFor={`enc-${spec.id}`}
              required
            >
              <FileUpload
                id={`enc-${spec.id}`}
                acceptRule={spec.rule}
                value={files[spec.id]}
                error={fileErrors[spec.id]}
                onChange={(next) => setEnclosure(spec.id, next)}
              />
            </FormField>
          ))}
        </section>
      ) : null}

      {current?.label === "Declaration" ? (
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-heading text-2xl text-primary">Declaration</h2>
          <p className="text-sm leading-6">{supervisorDeclaration}</p>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Place"
              htmlFor="place"
              required
              error={errors.place?.message}
            >
              <Input id="place" {...register("place")} />
            </FormField>
            <FormField label="Date" htmlFor="sup-date">
              <Input id="sup-date" readOnly value={formatIsoDate(referenceDate)} />
            </FormField>
          </div>
          <FormField label="Signature" htmlFor="sup-signature" required>
            <FileUpload
              id="sup-signature"
              acceptRule="supervisorSignature"
              value={files.signature}
              error={fileErrors.signature}
              onChange={(next) => setEnclosure("signature", next)}
            />
          </FormField>
        </section>
      ) : null}

      {current?.label === "Review" ? (
        <section className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm shadow-card">
          <h2 className="font-heading text-2xl text-primary">Review</h2>
          <p>
            <span className="font-semibold text-primary">Name. </span>
            {values.name}
          </p>
          <p>
            <span className="font-semibold text-primary">Designation. </span>
            {values.designation}, {values.department}
          </p>
          <p>
            <span className="font-semibold text-primary">Age. </span>
            {age || "—"}
          </p>
          <p>
            <span className="font-semibold text-primary">Email. </span>
            {values.email}
          </p>
          <p>
            <span className="font-semibold text-primary">Publications. </span>
            {values.publications.length}
          </p>
          <p>
            <span className="font-semibold text-primary">Teaching total. </span>
            {formatAge(teaching)}
          </p>
          <p>
            <span className="font-semibold text-primary">Proposed department. </span>
            {values.proposedDepartment}
          </p>
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
  name: FieldPath<SupervisorFormValues>;
  options: readonly string[];
  error?: string;
  register: UseFormRegister<SupervisorFormValues>;
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
  prefix: "permanent" | "communication";
  register: UseFormRegister<SupervisorFormValues>;
  errors: FieldErrors<SupervisorFormValues>;
}) {
  const fields = [
    ["door", "Door No"],
    ["street", "Street"],
    ["city", "City"],
    ["district", "District"],
    ["state", "State"],
    ["pin", "Pin Code"],
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

function QualBlock({
  title,
  prefix,
  register,
  errors,
  optional = false,
}: {
  title: string;
  prefix: "postgraduate" | "mphil" | "phd" | "dlitt";
  register: UseFormRegister<SupervisorFormValues>;
  errors: FieldErrors<SupervisorFormValues>;
  optional?: boolean;
}) {
  const fields = [
    ["exam", "University Exam Passed"],
    ["degree", "Degree"],
    ["university", "Name of the University"],
    ["discipline", "Discipline"],
    ["year", "Year of Passing"],
    ["classObtained", "Class Obtained"],
    ["percentage", "Percentage"],
  ] as const;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-primary">
        {title}
        {optional ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label]) => (
          <FormField
            key={key}
            label={label}
            htmlFor={`${prefix}-${key}`}
            required={!optional}
            error={nestedMessage(errors, `${prefix}.${key}`)}
          >
            <Input id={`${prefix}-${key}`} {...register(`${prefix}.${key}`)} />
          </FormField>
        ))}
      </div>
    </div>
  );
}

function DurationFields({
  label,
  years,
  months: monthName,
  register,
  errors,
}: {
  label: string;
  years: "preYears" | "postYears" | "researchYears";
  months: "preMonths" | "postMonths" | "researchMonths";
  register: UseFormRegister<SupervisorFormValues>;
  errors: FieldErrors<SupervisorFormValues>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField
        label={`${label} years`}
        htmlFor={years}
        required
        error={errors[years]?.message}
      >
        <Input id={years} inputMode="numeric" {...register(years)} />
      </FormField>
      <FormField
        label={`${label} months`}
        htmlFor={monthName}
        required
        error={errors[monthName]?.message}
      >
        <Input id={monthName} inputMode="numeric" {...register(monthName)} />
      </FormField>
    </div>
  );
}
