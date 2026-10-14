import { fileLimits, type FileLimitKey } from "@/lib/constants";

export type StoredFile = {
  file: File;
  previewUrl: string | null;
};

function sizeRule(file: File, rule: (typeof fileLimits)[FileLimitKey]) {
  if (file.type.startsWith("image/")) {
    return {
      minBytes: 1,
      maxBytes: fileLimits.photo.maxBytes,
      label: fileLimits.photo.label,
    };
  }
  if (file.type === "application/pdf") {
    return {
      minBytes: 1,
      maxBytes: fileLimits.resume.maxBytes,
      label: fileLimits.resume.label,
    };
  }
  return { minBytes: rule.minBytes, maxBytes: rule.maxBytes, label: rule.label };
}

export function fileError(file: File | null, ruleKey: FileLimitKey, required: boolean) {
  const rule = fileLimits[ruleKey];
  if (!file) return required ? "Upload this document." : null;
  if (!(rule.types as readonly string[]).includes(file.type)) {
    return `This file type is not accepted. Use ${rule.label}.`;
  }
  const size = sizeRule(file, rule);
  if (file.size < size.minBytes || file.size > size.maxBytes) {
    return `This file is outside the allowed size. Use ${size.label}.`;
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
    reader.onerror = () =>
      reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}
