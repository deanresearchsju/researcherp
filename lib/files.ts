import { fileLimits, type FileLimitKey } from "@/lib/constants";

export type StoredFile = {
  file: File;
  previewUrl: string | null;
};

export function fileError(file: File | null, ruleKey: FileLimitKey, required: boolean) {
  const rule = fileLimits[ruleKey];
  if (!file) return required ? "Upload this document." : null;
  if (!(rule.types as readonly string[]).includes(file.type)) {
    return `This file type is not accepted. Use ${rule.label}.`;
  }
  if (file.size < rule.minBytes || file.size > rule.maxBytes) {
    return `This file is outside the allowed size. Use ${rule.label}.`;
  }
  return null;
}

export function takeFile(file: File | null): StoredFile | null {
  if (!file) return null;
  const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
  return { file, previewUrl };
}

export function releaseFile(slot: StoredFile | null) {
  if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl);
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}
