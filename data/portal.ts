import type { Notice, PortalNavItem, Role } from "@/types";

export const portalNav: Record<Role, PortalNavItem[]> = {
  scholar: [
    { label: "Dashboard", href: "/scholar/dashboard", ready: true },
    { label: "ABC ID", href: "/scholar/records/abc-id", ready: true },
    { label: "Hall ticket", href: "/scholar/records/hall-ticket", ready: true },
    { label: "Personal details", href: "/scholar/records/personal-details", ready: true },
    { label: "Payment history", href: "/scholar/records/payment-history", ready: true },
    {
      label: "Ph.D. cancellation request",
      href: "/scholar/records/phd-cancellation",
      ready: true,
    },
    {
      label: "Supervisor change request",
      href: "/scholar/records/supervisor-change",
      ready: true,
    },
    {
      label: "Full-time to part-time request",
      href: "/scholar/records/study-mode-change",
      ready: true,
    },
    { label: "My application", href: "/scholar/dashboard", ready: false },
    { label: "Course work", href: "/scholar/dashboard", ready: false },
    { label: "Milestones", href: "/scholar/dashboard", ready: false },
    { label: "Publications", href: "/scholar/dashboard", ready: false },
    { label: "Documents", href: "/scholar/dashboard", ready: false },
  ],
  supervisor: [
    { label: "Dashboard", href: "/supervisor/dashboard", ready: true },
    { label: "My scholars", href: "/supervisor/dashboard", ready: false },
    { label: "Milestones", href: "/supervisor/dashboard", ready: false },
    { label: "Recognition", href: "/supervisor/dashboard", ready: false },
    { label: "Publications", href: "/supervisor/dashboard", ready: false },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", ready: true },
    { label: "Vacancies", href: "/admin/vacancies", ready: true },
    { label: "Applications", href: "/admin/applications", ready: true },
    { label: "Users", href: "/admin/users", ready: true },
    { label: "Our Team", href: "/admin/team", ready: true },
    { label: "ABC ID", href: "/admin/records/abc-id", ready: true },
    { label: "Hall ticket", href: "/admin/records/hall-ticket", ready: true },
    { label: "Personal details", href: "/admin/records/personal-details", ready: true },
    { label: "Payment history", href: "/admin/records/payment-history", ready: true },
    {
      label: "Ph.D. cancellation request",
      href: "/admin/records/phd-cancellation",
      ready: true,
    },
    {
      label: "Supervisor change request",
      href: "/admin/records/supervisor-change",
      ready: true,
    },
    {
      label: "Full-time to part-time request",
      href: "/admin/records/study-mode-change",
      ready: true,
    },
    { label: "Scholars", href: "/admin/dashboard", ready: false },
    { label: "Supervisors", href: "/admin/dashboard", ready: false },
    { label: "Announcements", href: "/admin/dashboard", ready: false },
    { label: "Schools", href: "/admin/dashboard", ready: false },
  ],
};

export const portalIntro: Record<Role, { title: string; summary: string }> = {
  scholar: {
    title: "Scholar dashboard",
    summary:
      "Upload your ABC ID, hall ticket, personal details, payments, and requests. The research office approves them.",
  },
  supervisor: {
    title: "Supervisor dashboard",
    summary:
      "Allotted scholars and their milestones will appear here after recognition is approved. This preview confirms the supervisor shell.",
  },
  admin: {
    title: "Admin dashboard",
    summary:
      "Review scholar uploads, approve requests, and download the records. Vacancies, the research team, and applications stay here too.",
  },
};

export const notices: Notice[] = [
  {
    id: "test",
    title: "Written test window",
    detail: "Shortlisted applicants will receive the test date by email.",
    time: "Today",
  },
  {
    id: "colloquium",
    title: "November colloquium",
    detail: "Scholars due this term may book the November sitting.",
    time: "This week",
  },
];
