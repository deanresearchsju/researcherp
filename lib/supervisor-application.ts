import { emptyAddress, emptyPublication, emptyQualification } from "@/lib/validation";
import type { SupervisorFormValues } from "@/lib/validation";
import type { Json } from "@/types/database";

export type SupervisorReceipt = {
  applicationNo: string;
  submittedOn: string;
  values: SupervisorFormValues;
  photo: string | null;
  signature: string | null;
  attachments: Record<string, string | null>;
};

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mergeAddress(value: unknown) {
  const empty = emptyAddress();
  const row = asRecord(value);
  if (!row) return empty;
  return {
    door: textOf(row.door) || empty.door,
    street: textOf(row.street) || empty.street,
    city: textOf(row.city) || empty.city,
    district: textOf(row.district) || empty.district,
    state: textOf(row.state) || empty.state,
    pin: textOf(row.pin) || empty.pin,
    country: textOf(row.country) || empty.country,
  };
}

function mergeQualification(value: unknown) {
  const empty = emptyQualification();
  const row = asRecord(value);
  if (!row) return empty;
  return {
    exam: textOf(row.exam),
    degree: textOf(row.degree),
    university: textOf(row.university),
    discipline: textOf(row.discipline),
    year: textOf(row.year),
    classObtained: textOf(row.classObtained),
    percentage: textOf(row.percentage),
    awardYear: textOf(row.awardYear),
  };
}

function mergePublications(value: unknown): SupervisorFormValues["publications"] {
  const fallback = Array.from({ length: 5 }, (_, index) =>
    emptyPublication(`pub-${index + 1}`),
  );
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map((item, index) => {
    const row = asRecord(item);
    const empty = emptyPublication(textOf(row?.id) || `pub-${index + 1}`);
    if (!row) return empty;
    return {
      id: textOf(row.id) || empty.id,
      title: textOf(row.title),
      journal: textOf(row.journal),
      doi: textOf(row.doi),
      year: textOf(row.year),
      month: textOf(row.month),
      url: textOf(row.url),
      pages: textOf(row.pages),
      indexing: textOf(row.indexing),
    };
  });
}

export function blankSupervisor(): SupervisorFormValues {
  return {
    name: "",
    designation: "",
    department: "",
    sex: "",
    dateOfBirth: "",
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
    recognisedElsewhere: "",
    recognitionDetails: "",
    otherInformation: "",
    place: "",
    agree: false,
  };
}

export function mergeSupervisorValues(partial: unknown): SupervisorFormValues {
  const empty = blankSupervisor();
  const parsed = asRecord(partial);
  if (!parsed) return empty;
  return {
    ...empty,
    name: textOf(parsed.name) || empty.name,
    designation: textOf(parsed.designation) || empty.designation,
    department: textOf(parsed.department) || empty.department,
    sex: textOf(parsed.sex) || empty.sex,
    dateOfBirth: textOf(parsed.dateOfBirth) || empty.dateOfBirth,
    state: textOf(parsed.state) || empty.state,
    nationality: textOf(parsed.nationality) || empty.nationality,
    permanent: mergeAddress(parsed.permanent),
    sameAddress: parsed.sameAddress !== false,
    communication: mergeAddress(parsed.communication),
    phone: textOf(parsed.phone) || empty.phone,
    email: textOf(parsed.email) || empty.email,
    postgraduate: mergeQualification(parsed.postgraduate),
    mphil: mergeQualification(parsed.mphil),
    phd: mergeQualification(parsed.phd),
    phdAwardYear: textOf(parsed.phdAwardYear) || empty.phdAwardYear,
    dlitt: mergeQualification(parsed.dlitt),
    faculty: textOf(parsed.faculty) || empty.faculty,
    subject: textOf(parsed.subject) || empty.subject,
    expertise: textOf(parsed.expertise) || empty.expertise,
    appointmentDate: textOf(parsed.appointmentDate) || empty.appointmentDate,
    publications: mergePublications(parsed.publications),
    preYears: textOf(parsed.preYears) || empty.preYears,
    preMonths: textOf(parsed.preMonths) || empty.preMonths,
    postYears: textOf(parsed.postYears) || empty.postYears,
    postMonths: textOf(parsed.postMonths) || empty.postMonths,
    researchYears: textOf(parsed.researchYears) || empty.researchYears,
    researchMonths: textOf(parsed.researchMonths) || empty.researchMonths,
    recognisedElsewhere: textOf(parsed.recognisedElsewhere) || empty.recognisedElsewhere,
    recognitionDetails: textOf(parsed.recognitionDetails) || empty.recognitionDetails,
    otherInformation: textOf(parsed.otherInformation) || empty.otherInformation,
    place: textOf(parsed.place) || empty.place,
    agree: Boolean(parsed.agree),
  };
}

function dataImage(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("data:")) return value;
  const row = asRecord(value);
  if (!row) return null;
  const fileData = row.fileData;
  return typeof fileData === "string" && fileData.startsWith("data:") ? fileData : null;
}

function imageFromRecord(record: Record<string, unknown>, key: string) {
  const images = asRecord(record.images);
  if (images) {
    const fromImages = dataImage(images[key]);
    if (fromImages) return fromImages;
  }
  const files = asRecord(record.files);
  if (files) {
    const fromFiles = dataImage(files[key]);
    if (fromFiles) return fromFiles;
  }
  return null;
}

function attachmentsFromPayload(record: Record<string, unknown>) {
  const attachments: Record<string, string | null> = {};
  const named = asRecord(record.attachments);
  if (named) {
    for (const [key, value] of Object.entries(named)) {
      attachments[key] = typeof value === "string" ? value : null;
    }
  }
  const files = asRecord(record.files);
  if (files) {
    for (const [key, value] of Object.entries(files)) {
      if (attachments[key]) continue;
      const row = asRecord(value);
      const fileName = row ? textOf(row.fileName) : "";
      attachments[key] = fileName || null;
    }
  }
  return attachments;
}

export function supervisorReceiptFromApplication(application: {
  applicationNo: string;
  createdAt: string;
  payload: Json;
}): SupervisorReceipt {
  const record = asRecord(application.payload) ?? {};
  return {
    applicationNo: application.applicationNo,
    submittedOn: application.createdAt.slice(0, 10),
    values: mergeSupervisorValues(application.payload),
    attachments: attachmentsFromPayload(record),
    photo: imageFromRecord(record, "photo"),
    signature: imageFromRecord(record, "signature"),
  };
}
