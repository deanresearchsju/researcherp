/**
 * A stored file is kept in one string. Older records hold the file itself as a data URL; newer
 * ones hold a short reference to the file in Supabase Storage, which opens like any address.
 */
export const privateFileRoute = "/api/files/";
export const publicBucketPath = "/storage/v1/object/public/portal-public/";

export function isFileRef(value: string) {
  return value.startsWith(privateFileRoute) || value.includes(publicBucketPath);
}

/** Anything a file field may hold: the file as a data URL, or a reference to it. */
export function isFileValue(value: string) {
  return value.startsWith("data:") || isFileRef(value);
}

export const storeFolders = {
  applications: "private",
  admission: "private",
  receipts: "private",
  records: "private",
  thesis: "private",
  documents: "private",
  news: "public",
  team: "public",
} as const;

export type StoreFolder = keyof typeof storeFolders;

/** The file types the ERP stores, with the first bytes that prove each one. */
export function sniffFileType(bytes: Uint8Array) {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { mime: "application/pdf", ext: "pdf" } as const;
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" } as const;
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: "image/png", ext: "png" } as const;
  }
  return null;
}
