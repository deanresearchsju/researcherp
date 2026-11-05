import { auditServer } from "@/lib/audit-server";
import { computeIncentive, policyRules } from "@/lib/faculty-incentives";
import { isApproved, maskAccount, type ResearchRecord } from "@/lib/faculty-research";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * The bank account a faculty member's publication incentives are credited to. Faculty enter it
 * once, on the open faculty page, after an incentive has been approved for them; it cannot be
 * changed there afterwards. It is shown back to them with only the last four digits. The
 * administrator and the Dean read it in full under Publication incentives.
 */
export type BankAccount = {
  holderName: string;
  accountNo: string;
  ifsc: string;
  bankName: string;
  branch: string;
  updatedAt?: string;
};

export type BankCheck =
  { ok: true; value: BankAccount } | { ok: false; errors: Record<string, string> };

const clip = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

export function cleanBank(input: unknown): BankCheck {
  const raw =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const value: BankAccount = {
    holderName: clip(raw.holderName, 120),
    accountNo: clip(raw.accountNo, 30).replace(/[\s-]/g, ""),
    ifsc: clip(raw.ifsc, 20).replace(/\s/g, "").toUpperCase(),
    bankName: clip(raw.bankName, 120),
    branch: clip(raw.branch, 120),
  };
  const errors: Record<string, string> = {};
  if (!value.holderName) errors.holderName = "Enter the account holder's name.";
  if (!/^\d{6,20}$/.test(value.accountNo))
    errors.accountNo = "Enter the account number (digits only).";
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.ifsc))
    errors.ifsc = "Enter the 11-character IFSC, such as SBIN0001234.";
  if (!value.bankName) errors.bankName = "Enter the bank name.";
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** What the faculty member sees of the saved account: the number masked. */
export function maskedBank(account: BankAccount): BankAccount {
  return { ...account, accountNo: maskAccount(account.accountNo) };
}

type Row = {
  faculty_key: string;
  holder_name: string;
  account_no: string;
  ifsc: string;
  bank_name: string;
  branch: string;
  updated_at: string;
};

const toAccount = (row: Row): BankAccount => ({
  holderName: row.holder_name,
  accountNo: row.account_no,
  ifsc: row.ifsc,
  bankName: row.bank_name,
  branch: row.branch,
  updatedAt: row.updated_at,
});

export async function bankOf(facultyKey: string): Promise<BankAccount | null> {
  const supabase = createAdminSupabase();
  if (!supabase || !facultyKey) return null;
  const { data, error } = await supabase
    .from("faculty_bank_accounts")
    .select("*")
    .eq("faculty_key", facultyKey)
    .maybeSingle();
  if (error) {
    console.error(error);
    return null;
  }
  return data ? toAccount(data as Row) : null;
}

/** Every saved account, by faculty key (for the incentive office only). */
export async function allBanks(): Promise<Record<string, BankAccount>> {
  const supabase = createAdminSupabase();
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("faculty_bank_accounts")
    .select("*")
    .limit(5000);
  if (error) {
    console.error(error);
    return {};
  }
  return Object.fromEntries(
    (data ?? []).map((row) => [row.faculty_key, toAccount(row as Row)]),
  );
}

/**
 * A faculty member's own Checked & Approved publication or patent that earns an incentive under
 * the policy (an online course, a paper outside the policy or a patent not yet granted does not).
 */
export function hasEligibleWork(records: readonly ResearchRecord[]) {
  return records.some(
    (record) =>
      record.kind === "publication" &&
      isApproved(record) &&
      computeIncentive(record, policyRules).amount > 0,
  );
}

/**
 * May the faculty member enter the bank account for incentives? Yes once they are eligible: an
 * incentive already approved for them, or approved work that earns one.
 */
export async function incentiveEligible(
  facultyKey: string,
  records: readonly ResearchRecord[] = [],
) {
  if (hasEligibleWork(records)) return true;
  const supabase = createAdminSupabase();
  if (!supabase || !facultyKey) return false;
  const { data, error } = await supabase
    .from("faculty_incentive_claims")
    .select("id")
    .eq("faculty_key", facultyKey)
    .in("status", ["Approved", "Paid"])
    .limit(1);
  if (error) {
    console.error(error);
    return false;
  }
  return (data ?? []).length > 0;
}

export const bankAlreadySaved =
  "Your bank account is already saved and cannot be changed here. To correct it, contact the research office.";

/** Saves the account the first time only: a second save for the same faculty member is refused. */
export async function saveBank(
  facultyKey: string,
  input: unknown,
  who: { name: string; email: string; actorRole: string; actorIdentifier: string },
) {
  const check = cleanBank(input);
  if (!check.ok) return check;
  const supabase = createAdminSupabase();
  if (!supabase) return { ok: false as const, errors: { form: "Not saved. Try again." } };
  const { error } = await supabase.from("faculty_bank_accounts").insert({
    faculty_key: facultyKey,
    faculty_name: who.name.slice(0, 120),
    email: who.email.slice(0, 200),
    holder_name: check.value.holderName,
    account_no: check.value.accountNo,
    ifsc: check.value.ifsc,
    bank_name: check.value.bankName,
    branch: check.value.branch,
    updated_at: new Date().toISOString(),
    updated_by: who.actorIdentifier,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false as const, errors: { form: bankAlreadySaved } };
    console.error(error);
    return { ok: false as const, errors: { form: "Not saved. Try again." } };
  }
  await auditServer({
    actorRole: who.actorRole,
    actorIdentifier: who.actorIdentifier,
    action: "faculty-incentive:bank-saved",
    subject: facultyKey,
    detail: `${who.name || facultyKey} saved the bank account for incentives: ${check.value.bankName}, IFSC ${check.value.ifsc}, account ${maskAccount(check.value.accountNo)}`,
  });
  return { ok: true as const, value: check.value };
}
