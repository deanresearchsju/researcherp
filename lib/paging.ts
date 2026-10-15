export function pageCount(total: number, size: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

export function pageSlice<T>(rows: readonly T[], page: number, size: number) {
  const current = Math.min(Math.max(1, page), pageCount(rows.length, size));
  const start = (current - 1) * size;
  return {
    page: current,
    start: start + 1,
    end: Math.min(start + size, rows.length),
    rows: rows.slice(start, start + size),
  };
}
