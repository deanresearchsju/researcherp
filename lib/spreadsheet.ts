import JSZip from "jszip";

import { isValidIsoDate } from "@/lib/dates";

/**
 * Reads a table from an Excel file (.xlsx) or a comma-separated file (.csv). The first row of the
 * sheet is the heading row. Everything comes back as text; a cell formatted as a date comes back
 * as an ISO date (2026-10-25).
 */
export type SheetTable = {
  headers: string[];
  rows: Record<string, string>[];
};

export type Workbook = {
  sheets: string[];
  read: (sheet: string) => Promise<SheetTable>;
};

function decode(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

function textOf(xml: string) {
  const parts = [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decode(match[1]));
  return parts.join("");
}

function columnIndex(reference: string) {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

/** An Excel date number (days since 1899-12-30) as an ISO date. */
export function excelSerialToIso(serial: number) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return "";
  const moment = new Date(Math.round((serial - 25569) * 86400) * 1000);
  const iso = moment.toISOString().slice(0, 10);
  return isValidIsoDate(iso) ? iso : "";
}

const builtInDateFormats = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function isDateFormat(id: number, formats: Map<number, string>) {
  if (builtInDateFormats.has(id)) return true;
  const code = (formats.get(id) ?? "").toLowerCase().replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  return /[dmyh]/.test(code) && !/[#0?]/.test(code.replace(/[dmyhs:/.\- ]/g, "")) && /d|y/.test(code);
}

function dateStyleIndexes(styles: string) {
  const formats = new Map<number, string>();
  for (const match of styles.matchAll(/<numFmt\s[^>]*?numFmtId="(\d+)"[^>]*?formatCode="([^"]*)"/g)) {
    formats.set(Number(match[1]), decode(match[2]));
  }
  const dates = new Set<number>();
  const block = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? "";
  [...block.matchAll(/<xf\s[^>]*?>/g)].forEach((match, index) => {
    const id = Number(/numFmtId="(\d+)"/.exec(match[0])?.[1] ?? 0);
    if (isDateFormat(id, formats)) dates.add(index);
  });
  return dates;
}

function numberText(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return raw;
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
  return String(Math.round(value * 1e9) / 1e9);
}

function tableFrom(grid: string[][]): SheetTable {
  const lines = grid.filter((line) => line.some((cell) => cell.trim() !== ""));
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map((cell) => cell.trim());
  const rows = lines.slice(1).map((line) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (line[index] ?? "").trim();
    });
    return record;
  });
  return { headers: headers.filter(Boolean), rows };
}

async function readXlsx(file: File): Promise<Workbook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const workbookXml = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const rels = (await zip.file("xl/_rels/workbook.xml.rels")?.async("string")) ?? "";
  const shared = (await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "";
  const styles = (await zip.file("xl/styles.xml")?.async("string")) ?? "";
  const strings = [...shared.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((match) =>
    textOf(match[1]),
  );
  const dateStyles = dateStyleIndexes(styles);
  const targets = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(match[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(match[0])?.[1];
    if (id && target) targets.set(id, target.replace(/^\/?(xl\/)?/, "xl/"));
  }
  const sheets = [...workbookXml.matchAll(/<sheet\s[^>]*>/g)].flatMap((match) => {
    const name = /\bname="([^"]*)"/.exec(match[0])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(match[0])?.[1];
    const path = rid ? targets.get(rid) : undefined;
    return name && path ? [{ name: decode(name), path }] : [];
  });
  return {
    sheets: sheets.map((sheet) => sheet.name),
    read: async (name: string) => {
      const sheet = sheets.find((item) => item.name === name) ?? sheets[0];
      const xml = sheet ? ((await zip.file(sheet.path)?.async("string")) ?? "") : "";
      const grid: string[][] = [];
      for (const rowMatch of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const line: string[] = [];
        for (const cell of (rowMatch[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attrs = cell[1];
          const body = cell[2] ?? "";
          const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
          const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? "n";
          const style = Number(/\bs="(\d+)"/.exec(attrs)?.[1] ?? -1);
          const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
          let value = "";
          if (type === "s") value = strings[Number(raw)] ?? "";
          else if (type === "inlineStr") value = textOf(body);
          else if (type === "str") value = decode(raw);
          else if (type === "b") value = raw === "1" ? "Yes" : "No";
          else if (raw !== "") {
            value = dateStyles.has(style) ? excelSerialToIso(Number(raw)) || numberText(raw) : numberText(raw);
          }
          line[ref ? columnIndex(ref) : line.length] = value;
        }
        for (let index = 0; index < line.length; index += 1) line[index] ??= "";
        grid.push(line);
      }
      return tableFrom(grid);
    },
  };
}

function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = first.includes("\t") ? "\t" : first.split(";").length > first.split(",").length ? ";" : ",";
  const grid: string[][] = [];
  let line: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      line.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      line.push(cell);
      grid.push(line);
      line = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || line.length > 0) {
    line.push(cell);
    grid.push(line);
  }
  return grid;
}

/** Opens a spreadsheet file; an Excel workbook may have several sheets. */
export async function openSpreadsheet(file: File): Promise<Workbook> {
  if (/\.xlsx$/i.test(file.name) || file.type.includes("spreadsheetml")) return readXlsx(file);
  if (/\.xls$/i.test(file.name)) {
    throw new Error("Save the file as .xlsx (Excel Workbook) or .csv and choose it again.");
  }
  const text = (await file.text()).replace(/^﻿/, "");
  const table = tableFrom(parseDelimited(text));
  return { sheets: ["Sheet 1"], read: async () => table };
}

/** Reads a sheet from raw bytes (for tests and scripts). */
export async function openSpreadsheetBytes(name: string, bytes: Uint8Array) {
  return openSpreadsheet(new File([bytes as BlobPart], name));
}
