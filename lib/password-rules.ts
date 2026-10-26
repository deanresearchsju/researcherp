/**
 * What a strong password is, in one place for the browser (live hints) and the server (the
 * real check): at least 10 characters with a capital letter, a small letter, a digit and a
 * symbol; not a common password; not the user's own sign-in or name.
 */

export const passwordMinLength = 10;
export const passwordMaxLength = 128;

const common = [
  "password",
  "welcome",
  "qwerty",
  "admin",
  "letmein",
  "iloveyou",
  "123456",
  "abcdef",
  "sju",
  "josephs",
];

export type PasswordCheck = { label: string; ok: boolean };

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: `At least ${passwordMinLength} characters`, ok: password.length >= passwordMinLength },
    { label: "A capital letter", ok: /[A-Z]/.test(password) },
    { label: "A small letter", ok: /[a-z]/.test(password) },
    { label: "A digit", ok: /\d/.test(password) },
    { label: "A symbol such as ! @ # $ %", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

/** The first thing wrong with the password, or null when it is strong enough. */
export function passwordProblem(
  password: string,
  personal: readonly string[] = [],
): string | null {
  if (password.length > passwordMaxLength) {
    return `Use at most ${passwordMaxLength} characters.`;
  }
  const failed = passwordChecks(password).find((item) => !item.ok);
  if (failed) return `A strong password needs: ${failed.label.toLowerCase()}.`;
  const lower = password.toLowerCase();
  if (common.some((word) => lower.includes(word))) {
    return "Do not use a common word such as password, welcome or admin.";
  }
  if (/(.)\1{3,}/.test(password)) return "Do not repeat the same character many times.";
  for (const value of personal) {
    const part = value.toLowerCase().split("@")[0].trim();
    if (part.length >= 4 && lower.includes(part)) {
      return "Do not use your name or sign-in in the password.";
    }
  }
  return null;
}
