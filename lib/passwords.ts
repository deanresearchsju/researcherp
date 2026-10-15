import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const prefix = "scrypt$";

export function hashSecret(plain: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 32).toString("hex");
  return `${prefix}${salt}$${hash}`;
}

export function isHashedSecret(stored: string) {
  return stored.startsWith(prefix);
}

export function verifySecret(plain: string, stored: string) {
  if (!plain || !stored) return false;
  if (!isHashedSecret(stored)) return stored === plain;
  const parts = stored.split("$");
  const salt = parts[1];
  const hash = parts[2];
  if (!salt || !hash) return false;
  const next = scryptSync(plain, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}
