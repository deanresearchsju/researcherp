import type { Role } from "@/types";

export type TestAccount = {
  role: Role;
  name: string;
  label: string;
  identifier: string;
  password: string;
};

/** Preview sign-in only. Replace these when a real auth provider is connected. */
export const testAccounts: TestAccount[] = [
  {
    role: "scholar",
    name: "Sample Scholar",
    label: "Scholar email",
    identifier: "scholar@example.com",
    password: "Scholar@2026",
  },
  {
    role: "scholar",
    name: "Sample Scholar",
    label: "Application number",
    identifier: "SJU/PHD/2026/0001",
    password: "Scholar@2026",
  },
  {
    role: "supervisor",
    name: "Test Supervisor",
    label: "Supervisor email",
    identifier: "supervisor@sju.test",
    password: "Guide@2026",
  },
  {
    role: "supervisor",
    name: "Test Supervisor",
    label: "Supervisor ID",
    identifier: "SUP-1001",
    password: "Guide@2026",
  },
  {
    role: "admin",
    name: "Research office",
    label: "Username",
    identifier: "admin",
    password: "Office@2026",
  },
];

export function accountsForRole(role: Role): TestAccount[] {
  return testAccounts.filter((account) => account.role === role);
}
