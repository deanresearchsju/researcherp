import { z } from "zod";

import { isPhdApplicationNo } from "@/lib/applications";
import {
  admissionSessions,
  admissionYear,
  bloodGroups,
  communityNeedsName,
  genders,
  indexingOptions,
  isNetQualified,
  netIncludesNet,
  netIncludesSet,
  maritalStatuses,
  months,
  netQualifications,
  paymentModes,
  programmeName,
  researchAreaLimit,
  sexes,
  studyModes,
  isPartTimeMode,
  titles,
  yesNo,
} from "@/lib/constants";
import { isOnOrBefore, isPastDate, isValidIsoDate, monthsBetween } from "@/lib/dates";

const oneOf = (values: readonly string[], message: string) =>
  z
    .string()
    .trim()
    .refine((value) => values.includes(value), message);

/** A year of passing or award: four digits, not in the future. */
export function isValidYear(value: string) {
  const text = value.trim();
  return /^(19|20)\d{2}$/.test(text) && Number(text) <= new Date().getFullYear();
}

/** Percentage (0 to 100) or CGPA, with up to two decimals. */
export function isValidScore(value: string) {
  const text = value.trim();
  return /^\d{1,3}(\.\d{1,2})?$/.test(text) && Number(text) > 0 && Number(text) <= 100;
}

const addressSchema = z
  .object({
    door: z.string().trim().min(1, "Enter the door number.").max(60),
    street: z.string().trim().min(1, "Enter the street.").max(120),
    city: z.string().trim().min(1, "Enter the city.").max(80),
    district: z.string().trim().min(1, "Enter the district.").max(80),
    state: z.string().trim().min(1, "Enter the state.").max(80),
    pin: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9 -]{4,10}$/, "Enter a valid pin code."),
    country: z.string().trim().min(2, "Enter the country."),
  })
  .superRefine((value, ctx) => {
    // Indian addresses carry a six-digit pin code.
    if (
      value.country.trim().toLowerCase() === "india" &&
      !/^\d{6}$/.test(value.pin.trim())
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the 6-digit pin code.",
        path: ["pin"],
      });
    }
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
  year: z.string().trim().refine(isValidYear, "Enter a valid 4-digit year of passing."),
  score: z
    .string()
    .trim()
    .refine(isValidScore, "Enter the percentage (up to 100) or CGPA, e.g. 72.5."),
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
    session: z
      .string()
      .trim()
      .refine(
        (value) =>
          (admissionSessions as readonly string[]).includes(value) || value === "June",
        "Select January or July.",
      ),
    year: z
      .string()
      .trim()
      .regex(/^(19|20)\d{2}$/, "The admission year is not open."),
    title: oneOf(titles, "Select a title."),
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(120)
      .regex(/^[\p{L} .'-]+$/u, "Use letters, spaces, and . ' - only."),
    dateOfBirth: z.string().refine(isPastDate, "Enter a valid past date of birth."),
    gender: oneOf(genders, "Select a gender."),
    nationality: z.string().trim().min(2, "Select Indian or Non-Indian.").max(60),
    country: z.string(),
    community: z.string().trim().min(1, "Select a community.").max(80),
    communityName: z.string(),
    bloodGroup: oneOf(bloodGroups, "Select a blood group."),
    maritalStatus: oneOf(maritalStatuses, "Select a marital status."),
    programme: z.literal(programmeName),
    studyMode: oneOf(studyModes, "Select a study mode."),
    school: z.string().trim().min(1, "Select a school."),
    specialization: z
      .string()
      .trim()
      .min(1, "Select a subject that currently has a vacancy."),
    interdisciplinary: z
      .string()
      .refine((value): boolean => value === "Yes" || value === "No", "Select Yes or No."),
    interdisciplinaryNote: z.string().trim().max(200),
    ug: educationSchema,
    pg: educationSchema,
    netQualified: z
      .string()
      .trim()
      .refine(
        (value) =>
          (netQualifications as readonly string[]).includes(value) ||
          (yesNo as readonly string[]).includes(value),
        "Select NET, SET, Both, or None.",
      ),
    netRoll: z.string(),
    netMonth: z.string(),
    netYear: z.string(),
    netAgency: z.string(),
    setRoll: z.string(),
    setYear: z.string(),
    setAgency: z.string(),
    email: z.string().trim().max(120).email("Enter a valid email address."),
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
      .min(3, "Enter the research area.")
      .max(researchAreaLimit, `Use ${researchAreaLimit} characters or fewer.`),
    outline: z.string(),
    paymentMode: oneOf(paymentModes, "Select UPI or Net Banking."),
    transactionNumber: z
      .string()
      .trim()
      .min(4, "Enter the transaction number.")
      .max(40)
      .regex(/^[A-Za-z0-9/-]+$/, "Use letters and digits only."),
    paymentDate: z.string().refine(isOnOrBefore, "Enter the date of payment."),
    agree: z.boolean().refine((value) => value, "Confirm the declaration to submit."),
    applicantName: z
      .string()
      .trim()
      .min(2, "Enter the applicant name.")
      .regex(/^[\p{L} .'-]+$/u, "Use letters, spaces, and . ' - only."),
  })
  .superRefine((value, ctx) => {
    if (value.nationality === "Non-Indian" && value.country.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Select the country.",
        path: ["country"],
      });
    }
    if (value.interdisciplinary === "Yes" && value.interdisciplinaryNote.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Name the other discipline(s) your research draws on.",
        path: ["interdisciplinaryNote"],
      });
    }
    if (communityNeedsName(value.community) && value.communityName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the sub-caste / community name.",
        path: ["communityName"],
      });
    }
    function requireExam(
      needed: boolean,
      roll: string,
      year: string,
      agency: string,
      paths: {
        roll: "netRoll" | "setRoll";
        year: "netYear" | "setYear";
        agency: "netAgency" | "setAgency";
      },
    ) {
      if (!needed) return;
      if (roll.trim().length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the certificate number.",
          path: [paths.roll],
        });
      }
      if (!isValidYear(year)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid 4-digit year of passing.",
          path: [paths.year],
        });
      }
      if (agency.trim().length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "Enter the agency name.",
          path: [paths.agency],
        });
      }
    }
    if (isNetQualified(value.netQualified)) {
      requireExam(
        netIncludesNet(value.netQualified),
        value.netRoll,
        value.netYear,
        value.netAgency,
        {
          roll: "netRoll",
          year: "netYear",
          agency: "netAgency",
        },
      );
      requireExam(
        netIncludesSet(value.netQualified),
        value.setRoll,
        value.setYear,
        value.setAgency,
        {
          roll: "setRoll",
          year: "setYear",
          agency: "setAgency",
        },
      );
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
    const partTime = isPartTimeMode(value.studyMode);
    const complete = value.experience.filter(
      (row) => row.organization.trim() && row.designation.trim() && row.from && row.to,
    );
    if (partTime && complete.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter work experience. This is required for part-time study.",
        path: ["experience"],
      });
    }
    value.experience.forEach((row, index) => {
      const started = rowFilled(row, ["organization", "designation", "from", "to"]);
      if (!partTime) return;
      if (!started && index > 0) return;
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
  if (row.year.trim() && !isValidYear(row.year)) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid 4-digit year.",
      path: ["year"],
    });
  }
  if (row.percentage.trim() && !isValidScore(row.percentage)) {
    ctx.addIssue({
      code: "custom",
      message: "Enter the percentage (up to 100), e.g. 72.5.",
      path: ["percentage"],
    });
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
    state: z.string().trim().min(2, "Enter the state."),
    nationality: z.string().trim().min(2, "Enter nationality."),
    permanent: addressSchema,
    sameAddress: z.boolean(),
    communication: looseAddress,
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a 10-digit contact number."),
    email: z.string().trim().max(120).email("Enter a valid email address."),
    postgraduate: requiredQualification,
    mphil: qualificationRow,
    phd: requiredQualification,
    phdAwardYear: z
      .string()
      .trim()
      .refine(isValidYear, "Enter the Ph.D. year of award (4 digits)."),
    dlitt: qualificationRow,
    faculty: z.string().trim().min(2, "Select or enter the school."),
    subject: z.string().trim().min(2, "Enter the subject."),
    expertise: z.string().trim().min(2, "Enter the area of expertise."),
    appointmentDate: z
      .string()
      .refine(
        (value) => isValidIsoDate(value) && isOnOrBefore(value),
        "Enter the date of appointment (not a future date).",
      ),
    publications: z
      .array(publicationRow)
      .min(5, "Add the best 5 post-doctoral publications."),
    preYears: z.string().regex(/^\d{1,2}$/, "Enter years."),
    preMonths: z.string().regex(/^(0?[0-9]|1[0-1])$/, "Enter 0 to 11 months."),
    postYears: z.string().regex(/^\d{1,2}$/, "Enter years."),
    postMonths: z.string().regex(/^(0?[0-9]|1[0-1])$/, "Enter 0 to 11 months."),
    researchYears: z.string().regex(/^\d{1,2}$/, "Enter years."),
    researchMonths: z.string().regex(/^(0?[0-9]|1[0-1])$/, "Enter 0 to 11 months."),
    // Kept for applications submitted earlier; the form no longer asks for it.
    recognisedElsewhere: z.string(),
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
      if (row.year.trim() && !isValidYear(row.year)) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid 4-digit year.",
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
  });

export type SupervisorFormValues = z.infer<typeof supervisorSchema>;

export const statusSchema = z.object({
  applicationNo: z
    .string()
    .trim()
    .refine(
      isPhdApplicationNo,
      `Enter an application number such as SJU/PHD/Jan${admissionYear.slice(-2)}/0001.`,
    ),
  dateOfBirth: z
    .string()
    .refine(isPastDate, "Enter the date of birth on the application."),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number."),
  subject: z.string().trim().min(3, "Enter the subject.").max(120),
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

export function emptyExperience() {
  return { organization: "", designation: "", from: "", to: "" };
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
