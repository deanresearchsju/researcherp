export const ROLES = ["scholar", "supervisor", "admin"] as const;

export type Role = (typeof ROLES)[number];

export type NavLink = {
  label: string;
  href: string;
};

export type SchoolIcon =
  | "cpu"
  | "flask"
  | "briefcase"
  | "building"
  | "sprout"
  | "scale"
  | "heart-pulse";

export type School = {
  id: string;
  name: string;
  summary: string;
  areas: string[];
  icon: SchoolIcon;
};

export type FeePlan = {
  id: string;
  name: string;
  duration: string;
  annualFee: string;
  period: string;
  summary: string;
  points: string[];
  featured?: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  date: string;
  isoDate: string;
  category: string;
  summary: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type Milestone = {
  id: string;
  title: string;
  detail: string;
};

export type Publication = {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: string;
  school: string;
};

export type ChecklistItem = {
  id: string;
  title: string;
  detail: string;
  required: boolean;
  badge?: string;
};

export type StatItem = {
  id: string;
  label: string;
  value: number;
};

export type QuickAccessIcon =
  "file-pen" | "graduation-cap" | "user-round" | "badge-check" | "search" | "download";

export type QuickAccessItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: QuickAccessIcon;
};

export type AdmissionStep = {
  id: string;
  title: string;
  detail: string;
};

export type DownloadItem = {
  id: string;
  title: string;
  description: string;
  note: string;
  href?: string;
};

export type PortalNavItem = {
  label: string;
  href: string;
  ready: boolean;
};

export type Notice = {
  id: string;
  title: string;
  detail: string;
  time: string;
};
