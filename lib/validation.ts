import { z } from "zod";

import {
  admissionSessions,
  admissionYear,
  bloodGroups,
  genders,
  indexingOptions,
  maritalStatuses,
  months,
  paymentModes,
  programmeName,
  researchWordLimit,
  sexes,
  studyModes,
  isPartTimeMode,
  titles,
  yesNo,
} from "@/lib/constants";
import {
  isOnOrBefore,
  isPastDate,
  isValidIsoDate,
  monthsBetween,
  wordCount,
} from "@/lib/dates";

const oneOf = (values: readonly string[], message: string) =>
  z
    .string()
    .trim()
    .refine((value) => values.includes(value), message);

const addressSchema = z.object({
  door: z.string().trim().min(1, "Enter the door number."),
  street: z.string().trim().min(1, "Enter the street."),
  city: z.string().trim().min(1, "Enter the city."),
  district: z.string().trim().min(1, "Enter the district."),
  state: z.string().trim().min(1, "Enter the state."),
  pin: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{4,10}$/, "Enter a valid pin code."),
  country: z.string().trim().min(2, "Enter the country."),
});

const looseAddress = z.object({
  door: z.string(),
  street: z.string(),
  city: z.string(),
  district: z.string(),
  state: z.string(),
  pin: z.string(),
  country: z.string(),
});

const educationSchema = z.object({
  degree: z.string().trim().min(1, "Enter the degree."),
  specialisation: z.string().trim().min(1, "Enter the specialisation."),
  institution: z.string().trim().min(1, "Enter the institution name."),
  university: z.string().trim().min(1, "Enter the university."),
  year: z
    .string()
    .trim()
    .regex(/^(19|20)\d{2}$/, "Enter the year of passing."),
  score: z.string().trim().min(1, "Enter the percentage or CGPA."),
});

const experienceRow = z.object({
  organization: z.string(),
  designation: z.string(),
  from: z.string(),
  to: z.string(),
});

const qualificationRow = z.object({
  exam: z.string(),
  degree: z.string(),
  university: z.string(),
  discipline: z.string(),
  year: z.string(),
  classObtained: z.string(),
  percentage: z.string(),
  awardYear: z.string(),
});

const publicationRow = z.object({
  id: z.string(),
  title: z.string(),
  journal: z.string(),
  doi: z.string(),
  year: z.string(),
  month: z.string(),
  url: z.string(),
  pages: z.string(),
  indexing: z.string(),
});

function rowFilled(row: Record<string, string>, keys: string[]) {
  return keys.some((key) => row[key]?.trim());
}

function requireRow(
  row: Record<string, string>,
  keys: { key: string; message: string }[],
  path: (string | number)[],
  ctx: z.RefinementCtx,
) {
  keys.forEach(({ key, message }) => {
    if (!row[key]?.trim()) {
      ctx.addIssue({ code: "custom", message, path: [...path, key] });
    }
  });
}

export const scholarSchema = z
  .object({
    session: oneOf(admissionSessions, "Select June or January."),
    year: z.literal(admissionYear),
    title: oneOf(titles, "Select a title."),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    dateOfBirth: z.string().refine(isPastDate, "Enter a valid past date of birth."),
    gender: oneOf(genders, "Select a gender."),
    nationality: z.string().trim().min(2, "Enter your nationality.").max(60),
    community: z.string().trim().min(1, "Enter your community.").max(60),
    bloodGroup: oneOf(bloodGroups, "Select a blood group."),
    maritalStatus: oneOf(maritalStatuses, "Select a marital status."),
    programme: z.literal(programmeName),
    studyMode: oneOf(studyModes, "Select a study mode."),
    school: z.string().trim().min(1, "Select a school or department."),
    specialization: z.string().trim().min(2, "Enter the specialisation.").max(120),
    ug: educationSchema,
    pg: educationSchema,
    netQualified: oneOf(yesNo, "Select Yes or No."),
    netMonth: z.string(),
    netYear: z.string(),
    email: z.string().trim().email("Enter a valid email address."),
    mobile: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number."),
    communication: addressSchema,
    sameAddress: z.boolean(),
    permanent: looseAddress,
    experience: z.array(experienceRow).min(1),
    researchArea: z
      .string()
      .trim()
      .min(3, "Enter the proposed area of research.")
      .max(160),
    outline: z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        const count = wordCount(value);
        if (count < researchWordLimit.min || count > researchWordLimit.max) {
          ctx.addIssue({
            code: "custom",
            message: `Write between ${researchWordLimit.min} and ${researchWordLimit.max} words.`,
          });
        }
      }),
    paymentMode: oneOf(paymentModes, "Select UPI or Net Banking."),
    transactionNumber: z.string().trim().min(4, "Enter the transaction number.").max(40),
    paymentDate: z.string().refine(isOnOrBefore, "Enter the date of payment."),
    agree: z.boolean().refine((value) => value, "Confirm the declaration to submit."),
    applicantName: z.string().trim().min(2, "Enter the applicant name."),
  })
  .superRefine((value, ctx) => {
    if (value.netQualified === "Yes") {
      if (!months.includes(value.netMonth as (typeof months)[number])) {
        ctx.addIssue({
          code: "custom",
          message: "Select the month of passing.",
          path: ["netMonth"],
        });
      }
      if (!/^(19|20)\d{2}$/.test(value.netYear.trim())) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the year of passing.",
          path: ["netYear"],
        });
      }
    }
    if (!value.sameAddress) {
      const parsed = addressSchema.safeParse(value.permanent);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          ctx.addIssue({
            code: "custom",
            message: issue.message,
            path: ["permanent", ...issue.path],
          });
        });
      }
    }
    const complete = value.experience.filter(
      (row) => row.organization.trim() && row.designation.trim() && row.from && row.to,
    );
    if (isPartTimeMode(value.studyMode) && complete.length === 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "Add at least one work-experience row. This is required for part-time study.",
        path: ["experience"],
      });
    }
    value.experience.forEach((row, index) => {
      const started = rowFilled(row, ["organization", "designation", "from", "to"]);
      if (!started && !isPartTimeMode(value.studyMode)) return;
      if (!started && complete.length > 0) return;
      if (isPartTimeMode(value.studyMode) && !started && index > 0) return;
      if (
        !started &&
        isPartTimeMode(value.studyMode) &&
        index === 0 &&
        complete.length === 0
      ) {
        return;
      }
      requireRow(
        row,
        [
          { key: "organization", message: "Enter the organisation." },
          { key: "designation", message: "Enter the designation." },
          { key: "from", message: "Enter the start date." },
          { key: "to", message: "Enter the end date." },
        ],
        ["experience", index],
        ctx,
      );
      if (row.from && row.to && monthsBetween(row.from, row.to) === null) {
        ctx.addIssue({
          code: "custom",
          message: "The end date must be on or after the start date.",
          path: ["experience", index, "to"],
        });
      }
    });
  });

export type ScholarFormValues = z.infer<typeof scholarSchema>;

const requiredQualification = qualificationRow.superRefine((row, ctx) => {
  requireRow(
    row,
    [
      { key: "exam", message: "Enter the examination." },
      { key: "degree", message: "Enter the degree." },
      { key: "university", message: "Enter the university." },
      { key: "discipline", message: "Enter the discipline." },
      { key: "year", message: "Enter the year of passing." },
      { key: "classObtained", message: "Enter the class obtained." },
      { key: "percentage", message: "Enter the percentage." },
    ],
    [],
    ctx,
  );
  if (row.year.trim() && !/^(19|20)\d{2}$/.test(row.year.trim())) {
    ctx.addIssue({ code: "custom", message: "Enter a 4-digit year.", path: ["year"] });
  }
});

export const supervisorSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the applicant name.")
      .regex(/^[A-Z .'-]+$/, "Use English block letters."),
    designation: z.string().trim().min(2, "Enter the designation."),
    department: z.string().trim().min(2, "Enter the department."),
    sex: oneOf(sexes, "Select sex."),
    dateOfBirth: z.string().refine(isPastDate, "Enter a valid past date of birth."),
    religion: z.string().trim().min(2, "Enter religion."),
    community: z.string().trim().min(1, "Enter community."),
    state: z.string().trim().min(2, "Enter the state."),
    nationality: z.string().trim().min(2, "Enter nationality."),
    permanent: addressSchema,
    sameAddress: z.boolean(),
    communication: looseAddress,
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit contact number."),
    email: z.string().trim().email("Enter a valid email address."),
    postgraduate: requiredQualification,
    mphil: qualificationRow,
    phd: requiredQualification,
    phdAwardYear: z
      .string()
      .trim()
      .regex(/^(19|20)\d{2}$/, "Enter the Ph.D. year of award."),
    dlitt: qualificationRow,
    faculty: z.string().trim().min(2, "Enter the faculty."),
    subject: z.string().trim().min(2, "Enter the subject."),
    expertise: z.string().trim().min(2, "Enter the area of expertise."),
    appointmentDate: z
      .string()
      .refine((value) => isValidIsoDate(value), "Enter the date of appointment."),
    publications: z
      .array(publicationRow)
      .min(5, "Add the best 5 post-doctoral publications."),
    preYears: z.string().regex(/^\d{1,2}$/, "Enter years."),
    preMonths: z.string().regex(/^(0?[0-9]|1[0-1])$/, "Enter 0 to 11 months."),
    postYears: z.string().regex(/^\d{1,2}$/, "Enter years."),
    postMonths: z.string().regex(/^(0?[0-9]|1[0-1])$/, "Enter 0 to 11 months."),
    researchYears: z.string().regex(/^\d{1,2}$/, "Enter years."),
    researchMonths: z.string().regex(/^(0?[0-9]|1[0-1])$/, "Enter 0 to 11 months."),
    proposedDepartment: z.string().trim().min(2, "Enter the department."),
    recognisedElsewhere: oneOf(yesNo, "Select Yes or No."),
    recognitionDetails: z.string(),
    otherInformation: z.string(),
    place: z.string().trim().min(2, "Enter the place."),
    agree: z.boolean().refine((value) => value, "Confirm the declaration to submit."),
  })
  .superRefine((value, ctx) => {
    if (!value.sameAddress) {
      const parsed = addressSchema.safeParse(value.communication);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          ctx.addIssue({
            code: "custom",
            message: issue.message,
            path: ["communication", ...issue.path],
          });
        });
      }
    }
    (["mphil", "dlitt"] as const).forEach((key) => {
      const row = value[key];
      const started = rowFilled(row, [
        "exam",
        "degree",
        "university",
        "discipline",
        "year",
        "classObtained",
        "percentage",
      ]);
      if (!started) return;
      const parsed = requiredQualification.safeParse(row);
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          ctx.addIssue({
            code: "custom",
            message: issue.message,
            path: [key, ...issue.path],
          });
        });
      }
    });
    if (value.publications.length < 5) {
      ctx.addIssue({
        code: "custom",
        message: "The best 5 post-doctoral publications are required.",
        path: ["publications"],
      });
    }
    value.publications.forEach((row, index) => {
      requireRow(
        row,
        [
          { key: "title", message: "Enter the title." },
          { key: "journal", message: "Enter the journal name." },
          { key: "doi", message: "Enter the DOI." },
          { key: "year", message: "Enter the year." },
          { key: "month", message: "Select the month." },
          { key: "url", message: "Enter the URL." },
          { key: "pages", message: "Enter the page numbers." },
          { key: "indexing", message: "Select the indexing." },
        ],
        ["publications", index],
        ctx,
      );
      if (row.year.trim() && !/^(19|20)\d{2}$/.test(row.year.trim())) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a 4-digit year.",
          path: ["publications", index, "year"],
        });
      }
      if (row.month && !months.includes(row.month as (typeof months)[number])) {
        ctx.addIssue({
          code: "custom",
          message: "Select the month.",
          path: ["publications", index, "month"],
        });
      }
      if (
        row.indexing &&
        !indexingOptions.includes(row.indexing as (typeof indexingOptions)[number])
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Select the indexing.",
          path: ["publications", index, "indexing"],
        });
      }
      if (row.url.trim() && !/^https?:\/\/\S+$/.test(row.url.trim())) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid http or https URL.",
          path: ["publications", index, "url"],
        });
      }
    });
    if (
      value.recognisedElsewhere === "Yes" &&
      value.recognitionDetails.trim().length < 3
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the university or institute and the details of recognition.",
        path: ["recognitionDetails"],
      });
    }
  });

export type SupervisorFormValues = z.infer<typeof supervisorSchema>;

export const statusSchema = z.object({
  applicationNo: z
    .string()
    .trim()
    .regex(
      /^SJU\/PHD\/\d{4}\/\d{4}$/,
      "Enter an application number such as SJU/PHD/2026/0001.",
    ),
  dateOfBirth: z
    .string()
    .refine(isPastDate, "Enter the date of birth on the application."),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  message: z.string().trim().min(10, "Write a short message.").max(1000),
});

export function emptyAddress() {
  return {
    door: "",
    street: "",
    city: "",
    district: "",
    state: "",
    pin: "",
    country: "India",
  };
}

export function emptyEducation() {
  return {
    degree: "",
    specialisation: "",
    institution: "",
    university: "",
    year: "",
    score: "",
  };
}

export function emptyQualification() {
  return {
    exam: "",
    degree: "",
    university: "",
    discipline: "",
    year: "",
    classObtained: "",
    percentage: "",
    awardYear: "",
  };
}

export function emptyPublication(id: string) {
  return {
    id,
    title: "",
    journal: "",
    doi: "",
    year: "",
    month: "",
    url: "",
    pages: "",
    indexing: "",
  };
}
