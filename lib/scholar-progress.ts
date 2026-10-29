import { archivedKeys, currentAdmission, ensureAdmission } from "@/lib/admission";
import {
  admissionSessions,
  admissionYear,
  programmeName,
  storageKeys,
} from "@/lib/constants";
import { matchesOpenPhdSession } from "@/lib/office";
import { createSupabase } from "@/lib/supabase/client";
import { lookupPhdApplication, toJson } from "@/lib/records";
import {
  emptyAddress,
  emptyEducation,
  emptyExperience,
  type ScholarFormValues,
} from "@/lib/validation";
import type { Json } from "@/types/database";

export type PhdReceipt = {
  applicationNo: string;
  status: string;
  submittedOn: string;
  values: ScholarFormValues;
  attachments: Record<string, string | null>;
  photo: string | null;
  signature: string | null;
};

type DraftRecord = {
  step: number;
  values: ScholarFormValues;
};

const stepCount = 10;

export function blankScholar(): ScholarFormValues {
  return {
    session: admissionSessions[0],
    year: admissionYear,
    title: "",
    fullName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "Indian",
    country: "",
    community: "",
    communityName: "",
    bloodGroup: "",
    maritalStatus: "",
    programme: programmeName,
    studyMode: "",
    school: "",
    specialization: "",
    interdisciplinary: "",
    interdisciplinaryNote: "",
    ug: emptyEducation(),
    pg: emptyEducation(),
    netQualified: "",
    netRoll: "",
    netMonth: "",
    netYear: "",
    netAgency: "",
    setRoll: "",
    setYear: "",
    setAgency: "",
    email: "",
    mobile: "",
    communication: emptyAddress(),
    sameAddress: true,
    permanent: emptyAddress(),
    experience: [emptyExperience()],
    researchArea: "",
    outline: "",
    paymentMode: "",
    transactionNumber: "",
    paymentDate: "",
    agree: false,
    applicantName: "",
  };
}

/** The subject, with the interdisciplinary note when the research draws on other disciplines. */
export function subjectLine(
  values: Pick<
    ScholarFormValues,
    "specialization" | "interdisciplinary" | "interdisciplinaryNote"
  >,
) {
  return values.interdisciplinary === "Yes" && values.interdisciplinaryNote
    ? `${values.specialization} (interdisciplinary: ${values.interdisciplinaryNote})`
    : values.specialization;
}

export function mergeScholarValues(partial: unknown): ScholarFormValues {
  const empty = blankScholar();
  if (!partial || typeof partial !== "object") return empty;
  const parsed = partial as Partial<ScholarFormValues>;
  return {
    ...empty,
    ...parsed,
    year: parsed.year?.trim() || empty.year,
    programme: programmeName,
    ug: { ...empty.ug, ...parsed.ug },
    pg: { ...empty.pg, ...parsed.pg },
    communication: { ...empty.communication, ...parsed.communication },
    permanent: { ...empty.permanent, ...parsed.permanent },
    experience:
      parsed.experience && parsed.experience.length > 0
        ? parsed.experience
        : empty.experience,
    sameAddress: parsed.sameAddress !== false,
    agree: Boolean(parsed.agree),
  };
}

function readMap<T>(key: string): Record<string, T> {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, T>;
  } catch {
    return {};
  }
}

function writeMap<T>(key: string, value: Record<string, T>) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readLocalDraft(mobile: string): DraftRecord | null {
  const record = readMap<DraftRecord>(storageKeys.scholarProgress)[mobile];
  if (!record?.values) return null;
  const step = Number(record.step);
  return {
    step: Number.isFinite(step) ? Math.min(Math.max(step, 0), stepCount - 1) : 0,
    values: mergeScholarValues(record.values),
  };
}

export function writeLocalDraft(mobile: string, step: number, values: ScholarFormValues) {
  const all = readMap<DraftRecord>(storageKeys.scholarProgress);
  all[mobile] = { step, values };
  writeMap(storageKeys.scholarProgress, all);
}

export function clearLocalDraft(mobile: string) {
  const all = readMap<DraftRecord>(storageKeys.scholarProgress);
  delete all[mobile];
  writeMap(storageKeys.scholarProgress, all);
  const tokens = readMap<string>(storageKeys.draftTokens);
  delete tokens[mobile];
  writeMap(storageKeys.draftTokens, tokens);
}

function draftTokenFor(mobile: string) {
  const tokens = readMap<string>(storageKeys.draftTokens);
  const existing = tokens[mobile];
  if (existing && existing.length >= 16) return existing;
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  tokens[mobile] = token;
  writeMap(storageKeys.draftTokens, tokens);
  return token;
}

export function readLocalReceipt(mobile: string): PhdReceipt | null {
  const record = readMap<PhdReceipt>(storageKeys.scholarReceipts)[mobile];
  if (!record?.applicationNo || !record.values) return null;
  return {
    ...record,
    values: mergeScholarValues(record.values),
    photo: record.photo ?? null,
    signature: record.signature ?? null,
  };
}

export function writeLocalReceipt(mobile: string, receipt: PhdReceipt) {
  const all = readMap<PhdReceipt>(storageKeys.scholarReceipts);
  all[mobile] = receipt;
  try {
    writeMap(storageKeys.scholarReceipts, all);
  } catch {
    all[mobile] = { ...receipt, photo: null, signature: null };
    try {
      writeMap(storageKeys.scholarReceipts, all);
    } catch {
      // The on-screen form still has the images for this visit.
    }
  }
}

export async function saveRemoteDraft(
  mobile: string,
  email: string,
  department: string,
  step: number,
  values: ScholarFormValues,
) {
  const supabase = createSupabase();
  if (!supabase) return;
  await supabase.rpc("upsert_phd_draft", {
    p_token: draftTokenFor(mobile),
    p_mobile: mobile,
    p_email: email,
    p_department: department,
    p_step: step,
    p_payload: toJson(values),
  });
}

export async function clearRemoteDraft(mobile: string) {
  const supabase = createSupabase();
  if (!supabase) return;
  const tokens = readMap<string>(storageKeys.draftTokens);
  const token = tokens[mobile];
  if (!token) return;
  await supabase.rpc("delete_phd_draft", { p_token: token });
}

function dataImage(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("data:")) return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fileData = (value as { fileData?: unknown }).fileData;
  return typeof fileData === "string" && fileData.startsWith("data:") ? fileData : null;
}

function imageFromRecord(record: Record<string, unknown>, key: string) {
  const images = record.images;
  if (images && typeof images === "object" && !Array.isArray(images)) {
    const fromImages = dataImage((images as Record<string, unknown>)[key]);
    if (fromImages) return fromImages;
  }
  const files = record.files;
  if (files && typeof files === "object" && !Array.isArray(files)) {
    const fromFiles = dataImage((files as Record<string, unknown>)[key]);
    if (fromFiles) return fromFiles;
  }
  return null;
}

function receiptFromPayload(
  applicationNo: string,
  status: string,
  submittedOn: string,
  payload: Json,
): PhdReceipt {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const attachments: Record<string, string | null> =
    record.attachments &&
    typeof record.attachments === "object" &&
    !Array.isArray(record.attachments)
      ? Object.fromEntries(
          Object.entries(record.attachments).map(([key, value]) => [
            key,
            typeof value === "string" ? value : null,
          ]),
        )
      : {};
  if (record.files && typeof record.files === "object" && !Array.isArray(record.files)) {
    for (const [key, value] of Object.entries(record.files)) {
      if (attachments[key]) continue;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const fileName = (value as { fileName?: unknown }).fileName;
        attachments[key] = typeof fileName === "string" ? fileName : null;
      }
    }
  }
  return {
    applicationNo,
    status,
    submittedOn,
    values: mergeScholarValues(payload),
    attachments,
    photo: imageFromRecord(record, "photo"),
    signature: imageFromRecord(record, "signature"),
  };
}

export function phdReceiptFromApplication(application: {
  applicationNo: string;
  status: string;
  createdAt: string;
  payload: Json;
}): PhdReceipt {
  return receiptFromPayload(
    application.applicationNo,
    application.status,
    application.createdAt.slice(0, 10),
    application.payload,
  );
}

async function livePhdKeys() {
  try {
    const admission = await ensureAdmission();
    return archivedKeys(admission.archived);
  } catch {
    return archivedKeys(currentAdmission()?.archived ?? []);
  }
}

function payloadPhdSession(payload: Json) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const session = typeof record.session === "string" ? record.session.trim() : "";
  const year = typeof record.year === "string" ? record.year.trim() : "";
  if (!session && !year) return null;
  return { session, year };
}

/**
 * The session whose selection is running. Closing the application window, or opening the next
 * window while this selection is still on, must not cut candidates off from their status,
 * hall ticket and letters: they stay until the session is closed and archived.
 */
async function runningSelection() {
  try {
    const admission = await ensureAdmission();
    const entrance = admission.progress.entrance;
    const year = entrance.monthYear.slice(0, 4);
    return entrance.session && year ? { session: entrance.session, year } : null;
  } catch {
    return null;
  }
}

function isLivePhdApplication(
  applicationNo: string,
  payload: Json,
  archived: ReadonlySet<string>,
  id = "",
  running: { session: string; year: string } | null = null,
) {
  if (archived.has(applicationNo) || (id && archived.has(id))) return false;
  const stored = payloadPhdSession(payload);
  if (!stored) return true;
  if (running && stored.session === running.session && stored.year === running.year) {
    return true;
  }
  return matchesOpenPhdSession(stored.session, stored.year);
}

export async function trackPhdApplication(
  applicationNo: string,
  dateOfBirth: string,
): Promise<
  { kind: "missing" } | { kind: "archived" } | { kind: "current"; receipt: PhdReceipt }
> {
  const remote = await lookupPhdApplication(applicationNo, dateOfBirth);
  if (!remote) return { kind: "missing" };
  const archived = await livePhdKeys();
  const running = await runningSelection();
  if (
    !isLivePhdApplication(
      remote.applicationNo,
      remote.payload,
      archived,
      remote.id,
      running,
    )
  ) {
    return { kind: "archived" };
  }
  return {
    kind: "current",
    receipt: receiptFromPayload(
      remote.applicationNo,
      remote.status,
      remote.createdAt.slice(0, 10),
      remote.payload,
    ),
  };
}

export async function findPhdByMobile(
  mobile: string,
  email: string,
): Promise<
  | { kind: "submitted"; receipt: PhdReceipt }
  | { kind: "draft"; step: number; values: ScholarFormValues }
  | { kind: "none" }
> {
  const supabase = createSupabase();
  const archived = await livePhdKeys();
  const running = await runningSelection();
  if (supabase) {
    const submitted = await supabase
      .from("phd_applications")
      .select("id, application_no, status, payload, created_at")
      .filter("payload->>mobile", "eq", mobile)
      // The mobile number alone would show an application to anyone who knows the number.
      .ilike("email", email.trim().replace(/[\\%_]/g, "\\$&"))
      .order("created_at", { ascending: false })
      .limit(20);
    const row = (submitted.data ?? []).find((item) =>
      isLivePhdApplication(item.application_no, item.payload, archived, item.id, running),
    );
    if (!submitted.error && row) {
      return {
        kind: "submitted",
        receipt: receiptFromPayload(
          row.application_no,
          row.status,
          row.created_at.slice(0, 10),
          row.payload,
        ),
      };
    }

    const token = readMap<string>(storageKeys.draftTokens)[mobile];
    if (token) {
      const draft = await supabase.rpc("get_phd_draft", { p_token: token });
      const payload = draft.data;
      if (
        !draft.error &&
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        "payload" in payload
      ) {
        const step = Number("step" in payload ? payload.step : 0);
        return {
          kind: "draft",
          step: Number.isFinite(step) ? Math.min(Math.max(step, 0), stepCount - 1) : 0,
          values: mergeScholarValues(payload.payload),
        };
      }
    }
  }

  const localReceipt = readLocalReceipt(mobile);
  if (
    localReceipt &&
    !archived.has(localReceipt.applicationNo) &&
    matchesOpenPhdSession(localReceipt.values.session, localReceipt.values.year)
  ) {
    return { kind: "submitted", receipt: localReceipt };
  }
  const localDraft = readLocalDraft(mobile);
  if (localDraft) return { kind: "draft", ...localDraft };
  return { kind: "none" };
}
