import { isFileRef, type StoreFolder } from "@/lib/file-ref";
import { fileToDataUrl } from "@/lib/files";

/**
 * Keeps a file in Supabase Storage and returns the short reference to save in the record, in
 * place of the file itself. Until storage is set up (or if it is unreachable) the file is kept
 * as a data URL, as before, so nothing is lost.
 */
export async function storeFile(file: File, folder: StoreFolder): Promise<string> {
  try {
    const body = new FormData();
    body.set("file", file);
    body.set("folder", folder);
    const response = await fetch("/api/files", { method: "POST", body });
    if (response.ok) {
      const result = (await response.json()) as { ok?: boolean; ref?: string };
      if (result.ok && result.ref) return result.ref;
    }
  } catch {
    // Fall back to keeping the file with the record.
  }
  return fileToDataUrl(file);
}

/** The file itself as a data URL, for printing and zipping, whether stored or referenced. */
export async function fileAsDataUrl(value: string): Promise<string> {
  if (!isFileRef(value)) return value;
  const response = await fetch(value);
  if (!response.ok) throw new Error("The file could not be opened.");
  const blob = await response.blob();
  return fileToDataUrl(new File([blob], "file", { type: blob.type }));
}
