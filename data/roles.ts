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
  footnote?: {
    prompt: string;
    label: string;
    href: string;
    secondary?: { label: string; href: string };
  };
};

export const roleProfiles: Record<Role, RoleProfile> = {
  scholar: {
    label: "Scholar",
    title: "Scholar sign in",
    welcome: "Welcome back, scholar",
    description: "",
    benefits: [
      "Track milestones from the first DC meeting to the thesis",
      "Keep documents and the fee receipt with your record",
      "Read notices from the Center for Research",
    ],
    identifierLabel: "Email address",
    identifierPlaceholder: "name@example.com",
    identifierError: "Enter the email address registered with the Center for Research.",
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
    description: "",
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
      secondary: {
        label: "Track your application",
        href: "/supervisor-recognition/status",
      },
    },
  },
  admin: {
    label: "Administrative",
    title: "Administrative Sign in",
    welcome: "Research office",
    description: "",
    benefits: [],
    identifierLabel: "Username",
    identifierPlaceholder: "Username",
    identifierError: "Enter your username.",
  },
  staff: {
    label: "Administrative",
    title: "Administrative Sign in",
    welcome: "Research office",
    description: "",
    benefits: [],
    identifierLabel: "Username",
    identifierPlaceholder: "Username",
    identifierError: "Enter your username.",
  },
  dean: {
    label: "Administrative",
    title: "Administrative Sign in",
    welcome: "Research office",
    description: "",
    benefits: [],
    identifierLabel: "Username",
    identifierPlaceholder: "Username",
    identifierError: "Enter your username.",
  },
};

export const resetCopy = {
  title: "Reset your password",
  welcome: "Password help",
  description:
    "Password recovery by email is not connected yet. Write to the research office with your sign-in id.",
  benefits: [
    "Scholars recover access with the registered email",
    "Supervisors use the email on the recognition record",
    "Administrators are reset by the research office",
  ],
};
