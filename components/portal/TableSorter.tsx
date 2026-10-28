"use client";

import { useEffect } from "react";

/**
 * Click a column heading to sort any list in the portal: ascending, descending, then the
 * original order. It works on the rows a table is showing (a paged list sorts its page), keeps
 * the sort when rows are added or removed, and leaves print sheets alone. Tables that must not
 * be sortable carry `data-no-sort`.
 */

type Direction = "ascending" | "descending";

type SortState = {
  column: number;
  direction: Direction;
  original: HTMLTableRowElement[];
  applied: HTMLTableRowElement[];
};

type Key =
  { kind: "empty" } | { kind: "number"; value: number } | { kind: "text"; value: string };

const monthPattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

function cellText(cell: Element) {
  const field = cell.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    "textarea, input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])",
  );
  if (field) return field.value.trim();
  const select = cell.querySelector("select");
  if (select) return select.selectedOptions[0]?.textContent?.trim() ?? "";
  return (cell.textContent ?? "").replace(/\s+/g, " ").trim();
}

function keyOf(raw: string): Key {
  const text = raw.trim();
  if (!text || /^[—–-]+$/.test(text) || /^n\/?a$/i.test(text)) return { kind: "empty" };
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { kind: "number", value: Date.parse(`${iso[1]}-${iso[2]}-${iso[3]}`) };
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return {
      kind: "number",
      value: Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])),
    };
  }
  if (monthPattern.test(text) && /\b\d{4}\b/.test(text) && /\d/.test(text)) {
    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) return { kind: "number", value: parsed };
  }
  const plain = text.replace(/[₹,\s]/g, "").replace(/%$/, "");
  if (/^-?\d+(\.\d+)?$/.test(plain)) return { kind: "number", value: Number(plain) };
  return { kind: "text", value: text };
}

function compare(a: Key, b: Key) {
  if (a.kind === "number" && b.kind === "number") return a.value - b.value;
  const left = a.kind === "number" ? String(a.value) : a.kind === "text" ? a.value : "";
  const right = b.kind === "number" ? String(b.value) : b.kind === "text" ? b.value : "";
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function dataRows(table: HTMLTableElement) {
  const body = table.tBodies[0];
  if (!body) return [];
  return Array.from(body.rows).filter(
    (row) =>
      row.cells.length > 0 && !Array.from(row.cells).some((cell) => cell.colSpan > 1),
  );
}

function headerCells(table: HTMLTableElement) {
  const head = table.tHead;
  if (!head || head.rows.length !== 1) return null;
  const cells = Array.from(head.rows[0].cells);
  if (cells.length === 0 || cells.some((cell) => cell.colSpan > 1)) return null;
  return cells;
}

function sortable(cell: HTMLTableCellElement) {
  if (cell.querySelector("input, select")) return false;
  const label = (cell.textContent ?? "").trim();
  return label !== "" && !/^actions?$/i.test(label);
}

function eligible(table: HTMLTableElement) {
  if (table.closest("[data-no-sort], .pdf-page, .print-root")) return false;
  const cells = headerCells(table);
  if (!cells || !table.tBodies[0]) return false;
  return true;
}

const states = new WeakMap<HTMLTableElement, SortState | null>();

function apply(table: HTMLTableElement, state: SortState) {
  const body = table.tBodies[0];
  if (!body) return;
  const sign = state.direction === "ascending" ? 1 : -1;
  const keyed = state.original
    .filter((row) => row.parentNode === body && row.cells.length > state.column)
    .map((row) => ({ row, key: keyOf(cellText(row.cells[state.column])) }));
  const filled = keyed.filter((item) => item.key.kind !== "empty");
  const empty = keyed.filter((item) => item.key.kind === "empty");
  filled.sort((a, b) => sign * compare(a.key, b.key));
  const ordered = [...filled, ...empty].map((item) => item.row);
  // Rows that cannot be sorted (a message spanning the table) stay where they were.
  const fixed = Array.from(body.rows).filter((row) => !ordered.includes(row));
  for (const row of [...ordered, ...fixed]) body.appendChild(row);
  state.applied = ordered;
}

function mark(
  table: HTMLTableElement,
  column: number | null,
  direction: Direction | null,
) {
  const cells = headerCells(table);
  if (!cells) return;
  cells.forEach((cell, index) => {
    if (!cell.hasAttribute("data-sortable")) return;
    cell.setAttribute("aria-sort", index === column && direction ? direction : "none");
  });
}

function toggle(table: HTMLTableElement, column: number) {
  const body = table.tBodies[0];
  if (!body) return;
  const current = states.get(table) ?? null;
  if (!current || current.column !== column) {
    const original = current?.original ?? dataRows(table);
    const next: SortState = { column, direction: "ascending", original, applied: [] };
    states.set(table, next);
    apply(table, next);
    mark(table, column, "ascending");
    return;
  }
  if (current.direction === "ascending") {
    current.direction = "descending";
    apply(table, current);
    mark(table, column, "descending");
    return;
  }
  for (const row of current.original) {
    if (row.parentNode === body) body.appendChild(row);
  }
  states.set(table, null);
  mark(table, null, null);
}

/** Enhances new tables, and keeps a sorted table sorted when its rows change. */
function scan() {
  for (const table of Array.from(document.querySelectorAll("table"))) {
    if (!eligible(table)) continue;
    const cells = headerCells(table);
    if (cells && !table.hasAttribute("data-sort-ready")) {
      table.setAttribute("data-sort-ready", "true");
      cells.forEach((cell) => {
        if (!sortable(cell)) return;
        cell.setAttribute("data-sortable", "true");
        cell.setAttribute("aria-sort", "none");
        cell.tabIndex = 0;
        cell.title = "Click to sort";
      });
    }
    const state = states.get(table);
    if (!state) continue;
    const rows = dataRows(table);
    const same =
      rows.length === state.applied.length &&
      rows.every((row, index) => row === state.applied[index]);
    if (same) continue;
    const known = new Set(state.original);
    state.original = [
      ...state.original.filter((row) => rows.includes(row)),
      ...rows.filter((row) => !known.has(row)),
    ];
    apply(table, state);
  }
}

export function TableSorter() {
  useEffect(() => {
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scan();
        // Our own row moves are not changes to react to.
        observer.takeRecords();
      });
    });

    function headerOf(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;
      if (target.closest("a, button, input, select, textarea, label")) return null;
      const cell = target.closest<HTMLTableCellElement>("th[data-sortable]");
      const table = cell?.closest("table");
      return cell && table ? { cell, table } : null;
    }

    function onClick(event: MouseEvent) {
      const found = headerOf(event.target);
      if (!found) return;
      const cells = headerCells(found.table);
      const column = cells ? cells.indexOf(found.cell) : -1;
      if (column < 0) return;
      toggle(found.table, column);
      observer.takeRecords();
    }

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const found = headerOf(event.target);
      if (!found) return;
      event.preventDefault();
      const cells = headerCells(found.table);
      const column = cells ? cells.indexOf(found.cell) : -1;
      if (column < 0) return;
      toggle(found.table, column);
      observer.takeRecords();
    }

    scan();
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
