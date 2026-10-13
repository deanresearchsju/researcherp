import { fileLimits } from "@/lib/constants";

function escapeCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]) {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCell(cell)).join(","),
  );
  return `\uFEFF${lines.join("\r\n")}`;
}

export function parseCsv(text: string) {
  const input = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char ?? "";
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char ?? "";
    }
  }

  row.push(cell);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  return rows;
}

export function recordsFromCsv(text: string) {
  const table = parseCsv(text);
  const headers = (table[0] ?? []).map((header) => header.trim());
  const records = table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
  return { headers, records };
}

export function field(record: Record<string, string>, names: readonly string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(key.trim().toLowerCase())) return value.trim();
  }
  return "";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function csvFileError(file: File) {
  const rule = fileLimits.spreadsheet;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return `Upload a .csv file. ${rule.label}.`;
  }
  if (file.size < rule.minBytes || file.size > rule.maxBytes) {
    return `This file is outside the allowed size. Use ${rule.label}.`;
  }
  return null;
}
