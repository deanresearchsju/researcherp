import { referenceDate } from "@/lib/constants";

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = month === 2 && leap ? 29 : monthLengths[month - 1];
  return day >= 1 && day <= (maxDay ?? 0);
}

export function isPastDate(value: string, on = referenceDate) {
  return isValidIsoDate(value) && value < on;
}

export function isOnOrBefore(value: string, on = referenceDate) {
  return isValidIsoDate(value) && value <= on;
}

export function isoDaysBefore(iso: string, days: number) {
  if (!isValidIsoDate(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

export function isWithinLastDays(isoDay: string, today: string, days: number) {
  const start = isoDaysBefore(today, days);
  if (!start || !isValidIsoDate(isoDay) || !isValidIsoDate(today)) return false;
  return isoDay >= start && isoDay <= today;
}

export function ageParts(dob: string, on = referenceDate) {
  if (!isValidIsoDate(dob) || !isValidIsoDate(on) || dob > on) return null;
  const [startYear, startMonth, startDay] = dob.split("-").map(Number);
  const [endYear, endMonth, endDay] = on.split("-").map(Number);
  if (
    startYear === undefined ||
    startMonth === undefined ||
    startDay === undefined ||
    endYear === undefined ||
    endMonth === undefined ||
    endDay === undefined
  ) {
    return null;
  }
  let years = endYear - startYear;
  let months = endMonth - startMonth;
  if (endDay < startDay) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  return { years, months };
}

export function formatAge(parts: { years: number; months: number } | null) {
  if (!parts) return "";
  const yearLabel = parts.years === 1 ? "year" : "years";
  const monthLabel = parts.months === 1 ? "month" : "months";
  return `${parts.years} ${yearLabel}, ${parts.months} ${monthLabel}`;
}

export function serviceUntilAge(dob: string, age: number, on = referenceDate) {
  const current = ageParts(dob, on);
  if (!current) return null;
  if (current.years > age || (current.years === age && current.months > 0)) {
    return { years: 0, months: 0 };
  }
  if (current.months === 0) return { years: age - current.years, months: 0 };
  return { years: age - current.years - 1, months: 12 - current.months };
}

export function monthsBetween(from: string, to: string) {
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || from > to) return null;
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  if (
    fromYear === undefined ||
    fromMonth === undefined ||
    toYear === undefined ||
    toMonth === undefined
  ) {
    return null;
  }
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function formatMonths(total: number | null) {
  if (total === null || total < 0) return "—";
  const years = Math.floor(total / 12);
  const months = total % 12;
  return `${years}y ${months}m`;
}

export function sumDuration(
  leftYears: string,
  leftMonths: string,
  rightYears: string,
  rightMonths: string,
) {
  const months = (Number(leftMonths) || 0) + (Number(rightMonths) || 0);
  const years =
    (Number(leftYears) || 0) + (Number(rightYears) || 0) + Math.floor(months / 12);
  return { years, months: months % 12 };
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function clientToday() {
  if (typeof window === "undefined") return referenceDate;
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function clientNowIso() {
  if (typeof window === "undefined") return `${referenceDate}T00:00:00.000Z`;
  return new Date().toISOString();
}

export function formatIsoDate(iso: string) {
  if (!isValidIsoDate(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${monthNames[month - 1]} ${year}`;
}

export function formatYearMonth(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const name = monthNames[month - 1];
  if (!year || !name) return value.trim();
  return `${name} ${year}`;
}

export function wordCount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const shortMonths = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/**
 * A date typed loosely in the old register ("27.5.25", "19/6/2025", "4 Mar 2026") as an ISO date
 * ("2025-05-27"), or "" when it cannot be read as one.
 */
export function looseDateToIso(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (isValidIsoDate(text)) return text;
  const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(text);
  const named = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ ,.-]*(\d{2}|\d{4})$/.exec(text);
  let day = 0;
  let month = 0;
  let year = 0;
  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = Number(numeric[3]);
    if (numeric[3].length === 2) year += 2000;
  } else if (named) {
    day = Number(named[1]);
    month = shortMonths.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    year = Number(named[3]);
    if (named[3].length === 2) year += 2000;
  }
  if (!day || !month || !year) return "";
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : "";
}
