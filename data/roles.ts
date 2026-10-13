import type { Role } from "@/types";

export type RoleProfile = {
  label: string;
  title: string;
  welcome: string;
  description: string;
  benefits: string[];
  identifierLabel: string;
  identifierPlaceholder: string;
  identifierError: string;
  footnote?: { prompt: string; label: string; href: string };
};

export const roleProfiles: Record<Role, RoleProfile> = {
  scholar: {
    label: "Scholar",
    title: "Scholar sign in",
    welcome: "Welcome back, scholar",
    description:
      "Follow your application, course work, and doctoral committee meetings from one place.",
    benefits: [
      "Track milestones from the first DC meeting to the thesis",
      "Keep documents and the fee receipt with your record",
      "Read notices from the Center for Research",
    ],
    identifierLabel: "Application number, registration number, or email",
    identifierPlaceholder: "Application no. / registration no. / email",
    identifierError: "Enter your application number, registration number, or email.",
    footnote: {
      prompt: "New applicant?",
      label: "Apply now",
      href: "/apply",
    },
  },
  supervisor: {
    label: "Supervisor",
    title: "Supervisor sign in",
    welcome: "Welcome, supervisor",
    description:
      "A recognised supervisor reviews scholar progress and the meetings that mark the doctorate.",
    benefits: [
      "See the scholars allotted to you",
      "Follow course work, colloquium, and DC meetings",
      "Keep publication details with each scholar’s record",
    ],
    identifierLabel: "Email or supervisor ID",
    identifierPlaceholder: "Email or supervisor ID",
    identifierError: "Enter your email address or supervisor ID.",
    footnote: {
      prompt: "Not recognised yet?",
      label: "Apply for Recognition",
      href: "/supervisor-recognition/apply",
    },
  },
  admin: {
    label: "Admin",
    title: "Admin sign in",
    welcome: "Research office",
    description:
      "Administrators review applications, recognise supervisors, and publish notices.",
    benefits: [
      "Review scholar applications and fee receipts",
      "Approve or return supervisor recognition requests",
      "Publish announcements to scholars and supervisors",
    ],
    identifierLabel: "Username",
    identifierPlaceholder: "Username",
    identifierError: "Enter your username.",
  },
};

export const resetCopy = {
  title: "Reset your password",
  welcome: "Password help",
  description: "Recovery uses the email on the scholar, supervisor, or admin record.",
  benefits: [
    "Scholars recover access with the registered email",
    "Supervisors use the email on the recognition record",
    "Administrators are reset by the research office",
  ],
};
