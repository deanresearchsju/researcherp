import { admissionYear, programmeName, storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import { toJson } from "@/lib/records";
import { emptyAddress, emptyEducation, type ScholarFormValues } from "@/lib/validation";
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
    session: "June",
    year: admissionYear,
    title: "",
    fullName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "Indian",
    community: "",
    bloodGroup: "",
    maritalStatus: "",
    programme: programmeName,
    studyMode: "",
    school: "",
    specialization: "",
    ug: emptyEducation(),
    pg: emptyEducation(),
    netQualified: "",
    netMonth: "",
    netYear: "",
    email: "",
    mobile: "",
    communication: emptyAddress(),
    sameAddress: true,
    permanent: emptyAddress(),
    experience: [{ organization: "", designation: "", from: "", to: "" }],
    researchArea: "",
    outline: "",
    paymentMode: "",
    transactionNumber: "",
    paymentDate: "",
    agree: false,
    applicantName: "",
  };
}

export function mergeScholarValues(partial: unknown): ScholarFormValues {
  const empty = blankScholar();
  if (!partial || typeof partial !== "object") return empty;
  const parsed = partial as Partial<ScholarFormValues>;
  return {
    ...empty,
    ...parsed,
    year: admissionYear,
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
  await supabase.from("phd_drafts").upsert({
    mobile,
    email,
    department,
    step,
    payload: toJson(values),
  });
}

export async function clearRemoteDraft(mobile: string) {
  const supabase = createSupabase();
  if (!supabase) return;
  await supabase.from("phd_drafts").delete().eq("mobile", mobile);
}

function receiptFromPayload(
  applicationNo: string,
  status: string,
  submittedOn: string,
  payload: Json,
): PhdReceipt {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const images =
    "images" in record &&
    record.images &&
    typeof record.images === "object" &&
    !Array.isArray(record.images)
      ? record.images
      : null;
  const photo =
    images &&
    "photo" in images &&
    typeof images.photo === "string" &&
    images.photo.startsWith("data:")
      ? images.photo
      : null;
  const signature =
    images &&
    "signature" in images &&
    typeof images.signature === "string" &&
    images.signature.startsWith("data:")
      ? images.signature
      : null;
  const attachments =
    "attachments" in record &&
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
  return {
    applicationNo,
    status,
    submittedOn,
    values: mergeScholarValues(payload),
    attachments,
    photo,
    signature,
  };
}

export async function findPhdByMobile(
  mobile: string,
): Promise<
  | { kind: "submitted"; receipt: PhdReceipt }
  | { kind: "draft"; step: number; values: ScholarFormValues }
  | { kind: "none" }
> {
  const supabase = createSupabase();
  if (supabase) {
    const submitted = await supabase
      .from("phd_applications")
      .select("application_no, status, payload, created_at")
      .filter("payload->>mobile", "eq", mobile)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = submitted.data?.[0];
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

    const draft = await supabase
      .from("phd_drafts")
      .select("step, payload")
      .eq("mobile", mobile)
      .maybeSingle();
    if (!draft.error && draft.data) {
      return {
        kind: "draft",
        step: Math.min(Math.max(draft.data.step, 0), stepCount - 1),
        values: mergeScholarValues(draft.data.payload),
      };
    }
  }

  const localReceipt = readLocalReceipt(mobile);
  if (localReceipt) return { kind: "submitted", receipt: localReceipt };
  const localDraft = readLocalDraft(mobile);
  if (localDraft) return { kind: "draft", ...localDraft };
  return { kind: "none" };
}
