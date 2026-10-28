/**
 * Slows down password guessing: after too many wrong passwords for the same sign-in from the
 * same address, further tries are refused for a while. Kept in memory of the server process.
 */
const windowMs = 15 * 60_000;
const limit = 8;

type Entry = { count: number; resetAt: number };
const failures = new Map<string, Entry>();

const keyOf = (address: string, identifier: string) =>
  `${address}|${identifier.trim().toLowerCase()}`;

export function loginBlocked(address: string, identifier: string, now = Date.now()) {
  const entry = failures.get(keyOf(address, identifier));
  if (!entry || entry.resetAt < now) return 0;
  return entry.count >= limit ? Math.ceil((entry.resetAt - now) / 60_000) : 0;
}

export function loginFailed(address: string, identifier: string, now = Date.now()) {
  const key = keyOf(address, identifier);
  const entry = failures.get(key);
  if (!entry || entry.resetAt < now)
    failures.set(key, { count: 1, resetAt: now + windowMs });
  else entry.count += 1;
  if (failures.size > 2000) failures.clear();
}

export function loginSucceeded(address: string, identifier: string) {
  failures.delete(keyOf(address, identifier));
}

export const loginLimit = limit;
