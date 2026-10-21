import { fileLimits, type FileLimitKey } from "@/lib/constants";

export type StoredFile = {
  file: File;
  previewUrl: string | null;
};

function sizeRule(file: File, ruleKey: FileLimitKey) {
  const rule = fileLimits[ruleKey];
  if (ruleKey === "document") {
    if (file.type.startsWith("image/")) {
      return {
        minBytes: fileLimits.photo.minBytes,
        maxBytes: fileLimits.photo.maxBytes,
        label: fileLimits.photo.label,
      };
    }
    if (file.type === "application/pdf") {
      return {
        minBytes: fileLimits.resume.minBytes,
        maxBytes: fileLimits.resume.maxBytes,
        label: "PDF, up to 1 MB",
      };
    }
  }
  return { minBytes: rule.minBytes, maxBytes: rule.maxBytes, label: rule.label };
}

export function fileTypeError(file: File, ruleKey: FileLimitKey) {
  const rule = fileLimits[ruleKey];
  if (!(rule.types as readonly string[]).includes(file.type)) {
    return `This file type is not accepted. Use ${rule.label}.`;
  }
  return null;
}

export function fileSizeError(file: File, ruleKey: FileLimitKey) {
  const size = sizeRule(file, ruleKey);
  if (file.size < size.minBytes || file.size > size.maxBytes) {
    if (file.type === "application/pdf") {
      return `This PDF is over 1 MB. Use a file of 1 MB or smaller.`;
    }
    return `This file is outside the allowed size. Use ${size.label}.`;
  }
  return null;
}

export function fileError(file: File | null, ruleKey: FileLimitKey, required: boolean) {
  if (!file) return required ? "Upload this document." : null;
  return fileTypeError(file, ruleKey) ?? fileSizeError(file, ruleKey);
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

export function dataUrlMime(dataUrl: string) {
  const match = /^data:([^;,]+)/i.exec(dataUrl.trim());
  return match?.[1]?.trim() ?? "";
}

export function dataUrlByteLength(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

export async function compressImage(file: File, maxBytes: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxBytes) return file;
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.9;
  let lastBlob: Blob | null = null;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob) lastBlob = blob;
    if (blob && blob.size <= maxBytes) {
      return new File([blob], file.name.replace(/\.\w+$/i, ".jpg"), {
        type: "image/jpeg",
      });
    }
    if (quality > 0.45) {
      quality -= 0.1;
    } else {
      width *= 0.82;
      height *= 0.82;
    }
  }
  if (lastBlob && lastBlob.size <= maxBytes) {
    return new File([lastBlob], file.name.replace(/\.\w+$/i, ".jpg"), {
      type: "image/jpeg",
    });
  }
  throw new Error("size");
}

export function cropAspectFor(ruleKey: FileLimitKey) {
  if (ruleKey === "photo") return 3.5 / 4.5;
  if (ruleKey === "scholarSignature" || ruleKey === "supervisorSignature") return 3;
  return null;
}
