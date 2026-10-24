import { fileLimits, type FileLimitKey } from "@/lib/constants";
import { isFileRef } from "@/lib/file-ref";
import { dataUrlByteLength, dataUrlMime } from "@/lib/files";

const uploadKeys: Record<string, FileLimitKey> = {
  photo: "photo",
  signature: "scholarSignature",
  dobProof: "document",
  ug: "document",
  pg: "document",
  feeReceipt: "document",
  noc: "document",
  net: "document",
};

export type UploadGuardResult = { ok: true } | { ok: false; message: string };

function ruleForMime(ruleKey: FileLimitKey, mime: string) {
  const rule = fileLimits[ruleKey];
  if (ruleKey === "document" && mime.startsWith("image/")) {
    return fileLimits.photo;
  }
  return rule;
}

export function assertStoredUpload(
  fileName: string,
  fileData: string,
  ruleKey: FileLimitKey,
): UploadGuardResult {
  // A file kept in storage was checked (type, size, content) when it was uploaded.
  if (isFileRef(fileData)) return { ok: true };
  const mime = dataUrlMime(fileData);
  const rule = ruleForMime(ruleKey, mime);
  if (!(rule.types as readonly string[]).includes(mime)) {
    return {
      ok: false,
      message: `${fileName || "This file"} is not an accepted type. Use ${rule.label}.`,
    };
  }
  const bytes = dataUrlByteLength(fileData);
  if (bytes < rule.minBytes || bytes > rule.maxBytes) {
    if (mime === "application/pdf") {
      return {
        ok: false,
        message: `${fileName || "This PDF"} is over 1 MB. Use a file of 1 MB or smaller.`,
      };
    }
    return {
      ok: false,
      message: `${fileName || "This file"} is outside the allowed size. Use ${rule.label}.`,
    };
  }
  return { ok: true };
}

export function assertPhdUploads(payload: unknown): UploadGuardResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: true };
  }
  const record = payload as Record<string, unknown>;
  const files = record.files;
  if (files && typeof files === "object" && !Array.isArray(files)) {
    for (const [key, slot] of Object.entries(files as Record<string, unknown>)) {
      if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
      const item = slot as Record<string, unknown>;
      const fileName = typeof item.fileName === "string" ? item.fileName : key;
      const fileData = typeof item.fileData === "string" ? item.fileData : "";
      if (!fileData) continue;
      const ruleKey = uploadKeys[key] ?? "document";
      const checked = assertStoredUpload(fileName, fileData, ruleKey);
      if (!checked.ok) return checked;
    }
  }
  const images = record.images;
  if (images && typeof images === "object" && !Array.isArray(images)) {
    const photo = (images as Record<string, unknown>).photo;
    const signature = (images as Record<string, unknown>).signature;
    if (typeof photo === "string" && photo) {
      const checked = assertStoredUpload("Photograph", photo, "photo");
      if (!checked.ok) return checked;
    }
    if (typeof signature === "string" && signature) {
      const checked = assertStoredUpload("Signature", signature, "scholarSignature");
      if (!checked.ok) return checked;
    }
  }
  return { ok: true };
}
