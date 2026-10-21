import { ensurePortraits, portraitFor } from "@/lib/portraits";
import { fetchProfilePhotos, profilePhotoKey } from "@/lib/profile-photo";
import { scholarBySignIn } from "@/lib/register";
import { registerScholarKeys, type ScholarReport } from "@/lib/scholar-report";

function safe(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "scholar";
}

function extensionOf(dataUrl: string) {
  const type = dataUrl.slice(5, dataUrl.indexOf(";"));
  return type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
}

function keysOf(row: ScholarReport) {
  const scholar = scholarBySignIn(row.identifier);
  return [
    ...new Set(
      [row.identifier, row.registration, row.email, ...(scholar ? registerScholarKeys(scholar) : [])].filter(
        (key) => key.trim(),
      ),
    ),
  ];
}

/**
 * Downloads the scholars' photos as a ZIP: one folder per batch, each photo named by the
 * registration number, with a list of who has no photo yet.
 */
export async function downloadScholarPhotos(
  rows: readonly ScholarReport[],
  label: string,
  onProgress?: (done: number, total: number) => void,
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const keys = rows.map(keysOf);
  const [photos, portraits] = await Promise.all([
    fetchProfilePhotos("scholar", keys.flat()),
    ensurePortraits().catch(() => null),
  ]);
  const used = new Set<string>();
  const list = ["Batch,Registration No.,Scholar,Photo,File"];
  let included = 0;
  const sorted = rows
    .map((row, index) => ({ row, keys: keys[index] }))
    .sort(
      (left, right) =>
        left.row.batchName.localeCompare(right.row.batchName) ||
        left.row.registration.localeCompare(right.row.registration) ||
        left.row.name.localeCompare(right.row.name),
    );
  for (const [position, { row, keys: rowKeys }] of sorted.entries()) {
    onProgress?.(position, sorted.length);
    const photo =
      rowKeys.map((key) => photos.get(profilePhotoKey("scholar", key))).find(Boolean) ??
      rowKeys.map((key) => portraitFor(portraits, key, row.name)).find(Boolean) ??
      null;
    const folder = safe(row.batchName || "No batch");
    let path = "";
    if (photo) {
      // Registration number; the name until a number is allotted.
      const registration = row.registration.includes("@") ? "" : row.registration;
      const base = safe(registration || row.name);
      const extension = extensionOf(photo);
      path = `${folder}/${base}${extension}`;
      for (let copy = 2; used.has(path); copy += 1) path = `${folder}/${base}-${copy}${extension}`;
      used.add(path);
      zip.file(path, photo.slice(photo.indexOf(",") + 1), { base64: true });
      included += 1;
    }
    list.push(
      [
        row.batchName,
        row.registration.includes("@") ? "" : row.registration,
        row.name,
        photo ? "Included" : "Not uploaded",
        path,
      ]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  zip.file("photo-list.csv", list.join("\n"));
  onProgress?.(sorted.length, sorted.length);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `scholar-photos-${safe(label).toLowerCase().replace(/\s+/g, "-")}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  return { included, missing: sorted.length - included };
}
