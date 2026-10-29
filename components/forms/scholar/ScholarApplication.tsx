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
import { PaymentInstructions } from "@/components/forms/PaymentInstructions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StepSidebar } from "@/components/forms/StepSidebar";
import { inputRules, masked, pinRuleFor } from "@/lib/input-rules";
import { ApplicationReceipt } from "@/components/forms/scholar/ApplicationReceipt";
import { ApplicationStart } from "@/components/forms/scholar/ApplicationStart";
import { scholarDocuments } from "@/data/documents";
import { scholarDeclaration } from "@/data/declarations";
import { netExamCopy, scholarFormCopy } from "@/data/forms";
import { countries } from "@/data/countries";
import { saveSubmission } from "@/lib/applications";
import {
  admissionYear,
  bloodGroups,
  communities,
  communityNeedsName,
  genders,
  isNetQualified,
  netIncludesNet,
  netIncludesSet,
  maritalStatuses,
  nationalities,
  netQualifications,
  paymentModes,
  paymentStatus,
  programmeName,
  researchAreaLimit,
  studyModes,
  isPartTimeMode,
  titles,
  referenceDate,
  yesNo,
} from "@/lib/constants";
import { formatNetQualification } from "@/lib/net-exam";
import { currentSiteSettings, formatPhdSession, parsePhdSession } from "@/lib/office";
import { attachmentFiles, attachmentNames, savePhdApplication } from "@/lib/records";
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
import { loadLiveVacancies } from "@/lib/live-vacancies";
import {
  allSchools,
  allSubjects,
  hasAnyOpenVacancy,
  hasOpenVacancy,
  type Vacancy,
} from "@/lib/vacancies";
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
import { emptyExperience, scholarSchema, type ScholarFormValues } from "@/lib/validation";
import { useFees } from "@/lib/fee-settings";
const steps = [
  {
    label: "Personal",
    fields: [
      "title",
      "fullName",
      "dateOfBirth",
      "gender",
      "nationality",
      "country",
      "community",
      "communityName",
      "bloodGroup",
      "maritalStatus",
    ],
  },
  {
    label: "Programme",
    fields: [
      "studyMode",
      "school",
      "specialization",
      "interdisciplinary",
      "interdisciplinaryNote",
    ],
  },
  {
    label: "Education",
    fields: [
      "ug",
      "pg",
      "netQualified",
      "netRoll",
      "netYear",
      "netAgency",
      "setRoll",
      "setYear",
      "setAgency",
    ],
  },
  {
    label: "Contact",
    fields: ["email", "mobile", "communication", "sameAddress", "permanent"],
  },
  { label: "Experience", fields: ["experience", "studyMode"] },
  { label: "Research", fields: ["researchArea"] },
  { label: "Payment", fields: ["paymentMode", "transactionNumber", "paymentDate"] },
  { label: "Documents", fields: [] },
  { label: "Declaration", fields: ["agree", "applicantName"] },
  { label: "Review", fields: [] },
] as const;

function asksExperience(studyMode: string) {
  return isPartTimeMode(studyMode);
}

function adjacentStep(from: number, direction: 1 | -1, studyMode: string) {
  let index = from + direction;
  while (
    index >= 0 &&
    index < steps.length &&
    steps[index]?.label === "Experience" &&
    !asksExperience(studyMode)
  ) {
    index += direction;
  }
  return Math.min(Math.max(index, 0), steps.length - 1);
}

function clampStep(index: number, studyMode: string) {
  if (steps[index]?.label === "Experience" && !asksExperience(studyMode)) {
    return Math.min(index + 1, steps.length - 1);
  }
  return index;
}

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
  if (spec.required === "part-time") return isPartTimeMode(values.studyMode);
  if (spec.id === "net") return isNetQualified(values.netQualified);
  return false;
}

export function ScholarApplication() {
  const applicationFeeInr = useFees().application;
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<ScholarFiles>(emptyFiles);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [receipt, setReceipt] = useState<PhdReceipt | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);

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
  const departmentOpen = hasOpenVacancy(vacancies, values.school, values.specialization);
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
    vacancies: Vacancy[];
  }) {
    setVacancies(start.vacancies);
    const found = await findPhdByMobile(start.mobile, start.email);
    if (found.kind === "submitted") {
      setReceipt(found.receipt);
      return;
    }
    const open = parsePhdSession(currentSiteSettings()?.admissionSession ?? "");
    const values: ScholarFormValues = {
      ...(found.kind === "draft" ? found.values : blankScholar()),
      mobile: start.mobile,
      email: start.email,
      session: open.month,
      year: open.year || admissionYear,
      programme: programmeName,
    };
    const nextStep = clampStep(found.kind === "draft" ? found.step : 0, values.studyMode);
    form.reset(values);
    setStep(nextStep);
    writeLocalDraft(start.mobile, nextStep, values);
    void saveRemoteDraft(start.mobile, start.email, values.school, nextStep, values);
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
      const ok = await trigger([...current.fields]);
      if (!ok) return;
    } else if (current.label === "Documents" || current.label === "Declaration") {
      const filesOk = validateFiles();
      const ok = current.fields.length === 0 ? true : await trigger([...current.fields]);
      if (!ok || !filesOk) return;
      if (current.label === "Documents" && !getValues("applicantName").trim()) {
        setValue("applicantName", getValues("fullName"));
      }
    } else if (current.label === "Programme") {
      let rows = vacancies;
      if (rows.length === 0) {
        rows = await loadLiveVacancies();
        setVacancies(rows);
      }
      const school = getValues("school");
      const subject = getValues("specialization");
      if (!hasOpenVacancy(rows, school, subject)) {
        setSubmitError(scholarFormCopy.noVacancyDepartment);
        return;
      }
      setSubmitError(null);
      const ok = await trigger([...current.fields]);
      if (!ok) return;
    } else if (current.fields.length > 0) {
      const ok = await trigger([...current.fields]);
      if (!ok) return;
    }
    const studyMode = getValues("studyMode");
    if (current.label === "Programme" && !asksExperience(studyMode)) {
      setValue("experience", [emptyExperience()]);
    }
    const nextStep = adjacentStep(step, 1, studyMode);
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
    if (index >= 0) setStep(clampStep(index, getValues("studyMode")));
  }

  async function onSubmit(submitted: ScholarFormValues) {
    const { phdApplicationsOpen } = await import("@/lib/office");
    if (!phdApplicationsOpen()) {
      setSubmitError("Admissions are currently closed.");
      return;
    }
    const openRows = await loadLiveVacancies();
    setVacancies(openRows);
    if (!hasOpenVacancy(openRows, submitted.school, submitted.specialization)) {
      setSubmitError(scholarFormCopy.noVacancyDepartment);
      setStep(steps.findIndex((item) => item.label === "Programme"));
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
      session: submitted.session,
      year: submitted.year,
      payload: {
        ...submitted,
        attachments: attachmentNames(files),
        files: await attachmentFiles(files),
        images: { photo: photo || null, signature: signature || null },
      },
    });
    if (!saved.ok) {
      setSubmitError(saved.message);
      return;
    }
    const applicationNo = saved.applicationNo;
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
    await clearRemoteDraft(submitted.mobile);
    clearLocalDraft(submitted.mobile);
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
  const visibleSteps = steps.filter(
    (item) => item.label !== "Experience" || asksExperience(values.studyMode),
  );
  const visibleIndex = Math.max(
    visibleSteps.findIndex((item) => item.label === current?.label),
    0,
  );

  return (
    <form
      className="space-y-4 lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0"
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      onChange={() => persist()}
      noValidate
    >
      <StepSidebar
        title="Ph.D. application"
        steps={visibleSteps.map((item) => item.label)}
        current={visibleIndex}
        onSelect={(index) => {
          const target = steps.findIndex(
            (item) => item.label === visibleSteps[index]?.label,
          );
          if (target >= 0) setStep(target);
        }}
      />
      <div className="min-w-0 space-y-4">
        {current?.label === "Personal" ? (
          <section className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3">
            <h2 className="font-heading text-xl text-primary sm:col-span-2 lg:col-span-3">
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
              <Input
                id="fullName"
                {...masked(register("fullName"), inputRules.personName)}
              />
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
              <NativeSelect id="nationality" {...register("nationality")}>
                <option value="">Select</option>
                {values.nationality &&
                !(nationalities as readonly string[]).includes(values.nationality) ? (
                  <option value={values.nationality}>{values.nationality}</option>
                ) : null}
                {nationalities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {values.nationality === "Non-Indian" ? (
              <FormField
                label="Country"
                htmlFor="country"
                required
                error={errors.country?.message}
              >
                <NativeSelect id="country" {...register("country")}>
                  <option value="">Select</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            ) : null}
            <FormField
              label="Community"
              htmlFor="community"
              required
              error={errors.community?.message}
            >
              <NativeSelect id="community" {...register("community")}>
                <option value="">Select</option>
                {values.community &&
                !(communities as readonly string[]).includes(values.community) ? (
                  <option value={values.community}>{values.community}</option>
                ) : null}
                {communities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {communityNeedsName(values.community) ? (
              <FormField
                label="Sub-caste / Community name"
                htmlFor="communityName"
                required
                error={errors.communityName?.message}
              >
                <Input
                  id="communityName"
                  {...masked(register("communityName"), inputRules.letters)}
                />
              </FormField>
            ) : null}
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
          <section className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-3">
            <h2 className="font-heading text-xl text-primary sm:col-span-2 lg:col-span-3">
              2. Programme Details
            </h2>
            <FormField label="Programme" htmlFor="programme">
              <Input id="programme" readOnly value={programmeName} />
            </FormField>
            <FormField
              label="School"
              htmlFor="school"
              required
              error={errors.school?.message}
            >
              <NativeSelect
                id="school"
                {...register("school", {
                  onChange: (event) => {
                    const school = event.target.value;
                    const allowed = allSubjects(vacancies, school);
                    if (!allowed.includes(getValues("specialization"))) {
                      setValue("specialization", "");
                    }
                    setSubmitError(null);
                  },
                })}
              >
                <option value="">Select</option>
                {allSchools(vacancies).map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label="Department"
              htmlFor="specialization"
              required
              error={errors.specialization?.message}
            >
              <NativeSelect
                id="specialization"
                disabled={
                  !values.school || allSubjects(vacancies, values.school).length === 0
                }
                {...register("specialization", { onChange: () => setSubmitError(null) })}
              >
                <option value="">Select</option>
                {(values.school ? allSubjects(vacancies, values.school) : []).map(
                  (subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ),
                )}
              </NativeSelect>
            </FormField>
            {vacancies.length > 0 && !hasAnyOpenVacancy(vacancies) ? (
              <p
                role="alert"
                className="text-sm font-semibold text-red-700 sm:col-span-2 lg:col-span-3"
              >
                {scholarFormCopy.noVacancy}
              </p>
            ) : null}
            {values.school && values.specialization && !departmentOpen ? (
              <p
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 sm:col-span-2 lg:col-span-3"
              >
                {scholarFormCopy.noVacancyDepartment}
              </p>
            ) : null}
            {!values.school || !values.specialization ? (
              <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-3">
                Select the school and the department. The next questions appear when the
                department has a vacancy in this session.
              </p>
            ) : null}
            {departmentOpen ? (
              <>
                <SelectField
                  id="studyMode"
                  label="Mode of study"
                  register={register}
                  name="studyMode"
                  error={errors.studyMode?.message}
                  options={studyModes}
                />
                <SelectField
                  id="interdisciplinary"
                  label="Is your proposed research interdisciplinary?"
                  register={register}
                  name="interdisciplinary"
                  error={errors.interdisciplinary?.message}
                  options={yesNo}
                />
                {values.interdisciplinary === "Yes" ? (
                  <FormField
                    label="Other discipline(s) involved"
                    htmlFor="interdisciplinaryNote"
                    required
                    error={errors.interdisciplinaryNote?.message}
                  >
                    <Input
                      id="interdisciplinaryNote"
                      maxLength={200}
                      {...register("interdisciplinaryNote")}
                    />
                  </FormField>
                ) : null}
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Interdisciplinary applicants may apply, but a vacancy must be available
                  in the department chosen above. The guide is allotted from that
                  department.
                </p>
              </>
            ) : null}
          </section>
        ) : null}

        {current?.label === "Education" ? (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-heading text-xl text-primary">3. Education Details</h2>
            <EducationBlock title="UG" prefix="ug" register={register} errors={errors} />
            <EducationBlock title="PG" prefix="pg" register={register} errors={errors} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                id="netQualified"
                label={netExamCopy.question}
                register={register}
                name="netQualified"
                error={errors.netQualified?.message}
                options={netQualifications}
              />
              {netIncludesNet(values.netQualified) ? (
                <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                  <h3 className="text-sm font-semibold text-primary">
                    {netExamCopy.net}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      label={netExamCopy.certificateNo}
                      htmlFor="netRoll"
                      required
                      error={errors.netRoll?.message}
                    >
                      <Input
                        id="netRoll"
                        {...masked(register("netRoll"), inputRules.reference)}
                      />
                    </FormField>
                    <FormField
                      label={netExamCopy.year}
                      htmlFor="netYear"
                      required
                      error={errors.netYear?.message}
                    >
                      <Input
                        id="netYear"
                        {...masked(register("netYear"), inputRules.year)}
                      />
                    </FormField>
                    <FormField
                      label={netExamCopy.agency}
                      htmlFor="netAgency"
                      required
                      error={errors.netAgency?.message}
                    >
                      <Input id="netAgency" {...register("netAgency")} />
                    </FormField>
                  </div>
                </div>
              ) : null}
              {netIncludesSet(values.netQualified) ? (
                <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                  <h3 className="text-sm font-semibold text-primary">
                    {netExamCopy.set}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                      label={netExamCopy.certificateNo}
                      htmlFor="setRoll"
                      required
                      error={errors.setRoll?.message}
                    >
                      <Input
                        id="setRoll"
                        {...masked(register("setRoll"), inputRules.reference)}
                      />
                    </FormField>
                    <FormField
                      label={netExamCopy.year}
                      htmlFor="setYear"
                      required
                      error={errors.setYear?.message}
                    >
                      <Input
                        id="setYear"
                        {...masked(register("setYear"), inputRules.year)}
                      />
                    </FormField>
                    <FormField
                      label={netExamCopy.agency}
                      htmlFor="setAgency"
                      required
                      error={errors.setAgency?.message}
                    >
                      <Input id="setAgency" {...register("setAgency")} />
                    </FormField>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {current?.label === "Contact" ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-heading text-xl text-primary">4. Contact Details</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Email Address"
                htmlFor="email"
                required
                error={errors.email?.message}
              >
                <Input id="email" {...masked(register("email"), inputRules.email)} />
              </FormField>
              <FormField
                label="Mobile Number"
                htmlFor="mobile"
                required
                error={errors.mobile?.message}
              >
                <Input id="mobile" {...masked(register("mobile"), inputRules.mobile)} />
              </FormField>
            </div>
            <h3 className="font-semibold text-primary">Address for Communication</h3>
            <AddressFields
              prefix="communication"
              register={register}
              errors={errors}
              country={values.communication?.country ?? ""}
            />
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
                <AddressFields
                  prefix="permanent"
                  register={register}
                  errors={errors}
                  country={values.permanent?.country ?? ""}
                />
              </div>
            )}
          </section>
        ) : null}

        {current?.label === "Experience" ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-heading text-xl text-primary">5. Work Experience</h2>
            <p className="text-sm text-muted-foreground">
              Work experience is required for part-time study.
            </p>
            {fieldMessage(errors.experience) ? (
              <p role="alert" className="text-sm text-secondary">
                {fieldMessage(errors.experience)}
              </p>
            ) : null}
            <DynamicRows
              addLabel="Add a row"
              onAdd={() =>
                setValue("experience", [...getValues("experience"), emptyExperience()])
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
                    required
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
                    required
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
                    required
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
                    required
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
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-heading text-xl text-primary">6. Proposed Research</h2>
            <FormField
              label="Research Area"
              htmlFor="researchArea"
              required
              error={errors.researchArea?.message}
            >
              <Input
                id="researchArea"
                maxLength={researchAreaLimit}
                {...register("researchArea")}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {values.researchArea.trim().length} / {researchAreaLimit} characters
              </p>
            </FormField>
          </section>
        ) : null}

        {current?.label === "Payment" ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-heading text-xl text-primary">7. Payment Details</h2>
            <div className="rounded-xl bg-muted p-3 text-sm leading-6">
              <p className="font-semibold text-primary">
                Application fee ₹{formatInr(applicationFeeInr)}
              </p>
            </div>
            <BankAccountCard />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                <Input
                  id="transactionNumber"
                  {...masked(register("transactionNumber"), inputRules.reference)}
                />
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
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-heading text-xl text-primary">8. Document Checklist</h2>
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
                        <td className="py-3 pr-3 font-semibold">
                          {uploaded ? "Y" : "N"}
                        </td>
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
          <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-heading text-xl text-primary">9. Declaration</h2>
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
              <Input
                id="applicantName"
                {...masked(register("applicantName"), inputRules.personName)}
              />
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
              <Input
                id="declaration-date"
                readOnly
                value={formatIsoDate(referenceDate)}
              />
            </FormField>
          </section>
        ) : null}

        {current?.label === "Review" ? (
          <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-card text-sm">
            <h2 className="font-heading text-xl text-primary">Review</h2>
            <ReviewLine
              label="Session"
              value={formatPhdSession(values.session, values.year)}
            />
            <ReviewLine
              label="Name"
              value={`${values.title} ${values.fullName}`.trim()}
            />
            <ReviewLine
              label="Date of birth"
              value={`${formatIsoDate(values.dateOfBirth)} (${age || "age pending"})`}
            />
            <ReviewLine
              label="Nationality"
              value={
                values.nationality === "Non-Indian"
                  ? `${values.nationality} · ${values.country}`
                  : values.nationality
              }
            />
            <ReviewLine
              label="Community"
              value={[values.community, values.communityName].filter(Boolean).join(" · ")}
            />
            <ReviewLine
              label="Programme"
              value={`${values.programme} · ${values.studyMode}`}
            />
            <ReviewLine label="School" value={values.school} />
            <ReviewLine label="Subject" value={values.specialization} />
            <ReviewLine
              label="Interdisciplinary"
              value={
                values.interdisciplinary === "Yes"
                  ? `Yes · ${values.interdisciplinaryNote}`
                  : values.interdisciplinary
              }
            />
            <ReviewLine label="NET / SET / SLET" value={formatNetQualification(values)} />
            <ReviewLine label="Email" value={values.email} />
            <ReviewLine label="Mobile" value={values.mobile} />
            {asksExperience(values.studyMode) ? (
              <ReviewLine
                label="Work experience"
                value={
                  values.experience
                    .filter((row) => row.organization.trim())
                    .map((row) =>
                      [row.organization, row.designation, row.from, row.to]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join(" | ") || "—"
                }
              />
            ) : null}
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
        <div className="sticky bottom-0 z-20 flex flex-wrap gap-3 border-t border-border bg-card/95 py-3 backdrop-blur-md">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setStep((value) => adjacentStep(value, -1, getValues("studyMode")))
              }
            >
              Back
            </Button>
          ) : null}
          {current?.label === "Review" ? (
            <Button type="submit" variant="gold" disabled={isSubmitting}>
              Submit application
            </Button>
          ) : (
            <Button
              type="button"
              variant="gold"
              disabled={current?.label === "Programme" && !departmentOpen}
              onClick={() => void continueStep()}
            >
              Save & Next
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function BankAccountCard() {
  const applicationFeeInr = useFees().application;
  return <PaymentInstructions amount={applicationFeeInr} purpose="Application fee" />;
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
  country,
}: {
  prefix: "communication" | "permanent";
  register: UseFormRegister<ScholarFormValues>;
  errors: FieldErrors<ScholarFormValues>;
  country: string;
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([key, label]) => (
        <FormField
          key={key}
          label={label}
          htmlFor={`${prefix}-${key}`}
          required
          error={nestedMessage(errors, `${prefix}.${key}`)}
        >
          <Input
            id={`${prefix}-${key}`}
            {...(key === "pin"
              ? masked(register(`${prefix}.${key}`), pinRuleFor(country))
              : register(`${prefix}.${key}`))}
          />
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([key, label]) => (
          <FormField
            key={key}
            label={label}
            htmlFor={`${prefix}-${key}`}
            required
            error={nestedMessage(errors, `${prefix}.${key}`)}
          >
            <Input
              id={`${prefix}-${key}`}
              {...(key === "year"
                ? masked(register(`${prefix}.${key}`), inputRules.year)
                : key === "score"
                  ? masked(register(`${prefix}.${key}`), inputRules.score)
                  : register(`${prefix}.${key}`))}
            />
          </FormField>
        ))}
      </div>
    </div>
  );
}
