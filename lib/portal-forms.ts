/** Forms and formats the research office publishes for download. */

export const formAudiences = ["scholar", "supervisor", "public"] as const;
export type FormAudience = (typeof formAudiences)[number];

export const formAudienceLabels: Record<FormAudience, string> = {
  scholar: "Scholars",
  supervisor: "Supervisors",
  public: "Public website",
};

export const formCategories = [
  "Admission",
  "Course work",
  "Doctoral committee",
  "Six-month report",
  "Synopsis & thesis",
  "Requests",
  "Fee",
  "Supervisor",
  "General",
] as const;

/** Word and PDF only. */
export const formFileTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const formFileAccept = ".pdf,.doc,.docx";
export const formMaxBytes = 10 * 1024 * 1024;
export const formFileRule = "Word (.doc, .docx) or PDF, up to 10 MB.";

export type PortalForm = {
  id: string;
  title: string;
  category: string;
  audience: FormAudience[];
  fileName: string;
  fileType: string;
  fileSize: number;
  /** False while a large upload is still arriving. */
  complete: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
};

export function formExtension(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

/** The MIME type for an allowed Word or PDF file name; null for anything else. */
export function formFileType(fileName: string) {
  return formFileTypes[formExtension(fileName)] ?? null;
}

export function formKindLabel(fileName: string) {
  const extension = formExtension(fileName);
  return extension === "pdf" ? "PDF" : extension ? "Word" : "File";
}

export function formSizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function parseAudience(value: unknown): FormAudience[] {
  if (!Array.isArray(value)) return [];
  return formAudiences.filter((audience) => value.includes(audience));
}

/** Link that downloads the file; the server checks who may have it. */
export function formDownloadHref(id: string) {
  return `/api/forms?id=${encodeURIComponent(id)}`;
}

type ListResult = { ok: true; forms: PortalForm[] } | { ok: false; message: string };

export async function listForms(): Promise<ListResult> {
  try {
    const response = await fetch("/api/forms", { cache: "no-store" });
    const body = (await response.json()) as
      { ok: true; forms: PortalForm[] } | { ok: false; message: string };
    return body.ok ? { ok: true, forms: body.forms } : body;
  } catch {
    return { ok: false, message: "The forms could not be loaded. Check the connection." };
  }
}

export type FormDraft = {
  id?: string;
  title: string;
  category: string;
  audience: FormAudience[];
  fileName?: string;
  fileData?: string;
};

type PostResult = { ok: boolean; id?: string; message?: string };

async function post(body: Record<string, unknown>): Promise<PostResult> {
  try {
    const response = await fetch("/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as PostResult;
  } catch {
    return { ok: false, message: "That could not be saved. Check the connection." };
  }
}

/** Base64 characters per request, keeping each request under the host's 4.5 MB limit. */
const partChars = 3_000_000;

/**
 * Saves the form's details and, when a file is chosen, uploads it: in one request when small,
 * otherwise in parts (the form stays hidden from readers until the last part arrives).
 */
export async function saveForm(
  draft: FormDraft & { fileSize?: number },
  onProgress?: (percent: number) => void,
): Promise<PostResult> {
  const data = draft.fileData ?? "";
  const comma = data.indexOf(",");
  const base64 = comma >= 0 ? data.slice(comma + 1) : "";
  if (!draft.fileName || base64.length <= partChars) {
    const result = await post({ action: "save", ...draft });
    if (result.ok) onProgress?.(100);
    return result;
  }
  const prefix = data.slice(0, comma + 1);
  const first = await post({
    action: "save",
    ...draft,
    fileData: prefix + base64.slice(0, partChars),
    moreParts: true,
  });
  if (!first.ok || !first.id) return first;
  let result: PostResult = first;
  for (let start = partChars; start < base64.length; start += partChars) {
    onProgress?.(Math.round((start / base64.length) * 100));
    result = await post({
      action: "append",
      id: first.id,
      data: base64.slice(start, start + partChars),
      last: start + partChars >= base64.length,
    });
    if (!result.ok) return result;
  }
  onProgress?.(100);
  return { ok: true, id: first.id, message: result.message || first.message };
}

export function deleteForm(id: string): Promise<PostResult> {
  return post({ action: "delete", id });
}
