"use client";

import { buildApprovedCopy } from "@/lib/approved-copy";
import type { ApprovedDocument } from "@/lib/approved-documents";

function safe(value: string) {
  return (
    value
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "file"
  );
}

function extensionOf(dataUrl: string, fileName: string | null) {
  const fromName = fileName?.match(/\.[a-z0-9]+$/i)?.[0];
  if (fromName) return fromName.toLowerCase();
  if (dataUrl.startsWith("data:application/pdf")) return ".pdf";
  if (dataUrl.startsWith("data:image/png")) return ".png";
  if (dataUrl.startsWith("data:image/jp")) return ".jpg";
  return "";
}

function base64Of(dataUrl: string) {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

async function logoBytes() {
  try {
    const response = await fetch("/assets/logo-full.jpeg");
    return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/**
 * One ZIP of the chosen approved documents, in a folder per scholar. "approved" adds the
 * approval stamp and record page; "original" keeps the files as uploaded.
 */
export async function downloadApprovedZip(
  documents: readonly ApprovedDocument[],
  kind: "approved" | "original",
  onProgress?: (done: number, total: number) => void,
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const logo = kind === "approved" ? await logoBytes() : null;
  const used = new Set<string>();
  const index: string[] = ["Scholar,Document,Approved on,Approved by,File"];
  let skipped = 0;
  for (const [position, item] of documents.entries()) {
    onProgress?.(position, documents.length);
    const data =
      item.fileData ?? (item.load ? await item.load().catch(() => null) : null);
    const folder = safe(item.scholarName);
    let name = `${safe(item.title)}`;
    let content: Uint8Array | string | null = null;
    let base64 = false;
    if (kind === "approved") {
      content = await buildApprovedCopy(data, item.fileName, item.stamp, logo);
      name += "-approved.pdf";
    } else if (data) {
      content = base64Of(data);
      base64 = true;
      name += extensionOf(data, item.fileName);
    } else {
      skipped += 1;
      continue;
    }
    let path = `${folder}/${name}`;
    for (let copy = 2; used.has(path); copy += 1) {
      path = `${folder}/${name.replace(/(\.[a-z0-9]+)?$/i, `-${copy}$1`)}`;
    }
    used.add(path);
    zip.file(path, content, { base64 });
    index.push(
      [item.scholarName, item.title, item.stamp.approvedOn, item.stamp.approvedBy, path]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  zip.file("index.csv", index.join("\n"));
  onProgress?.(documents.length, documents.length);
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `approved-documents-${kind}-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
  return { skipped };
}
