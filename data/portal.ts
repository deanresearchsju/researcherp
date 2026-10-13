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
    { label: "Publications", href: "/scholar/records/publications", ready: true },
    { label: "Six-month report", href: "/scholar/records/six-month-report", ready: true },
    { label: "RAC members", href: "/scholar/rac", ready: true },
  ],
  supervisor: [
    { label: "Dashboard", href: "/supervisor/dashboard", ready: true },
    { label: "My scholars", href: "/supervisor/scholars", ready: true },
    { label: "RAC proposal", href: "/supervisor/rac", ready: true },
    { label: "Scholar requests", href: "/supervisor/reviews", ready: true },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", ready: true },
    { label: "Home and admissions", href: "/admin/site", ready: true },
    { label: "Scholar allotment", href: "/admin/allocations", ready: true },
    { label: "RAC", href: "/admin/rac", ready: true },
    { label: "People", href: "/admin/people", ready: true },
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
    { label: "Publications", href: "/admin/records/publications", ready: true },
    { label: "Six-month report", href: "/admin/records/six-month-report", ready: true },
  ],
};

export const portalIntro: Record<Role, { title: string; summary: string }> = {
  scholar: {
    title: "Scholar dashboard",
    summary:
      "Your payments, publications, reports, and requests. A mapped supervisor reviews the academic requests before the research office.",
  },
  supervisor: {
    title: "Supervisor dashboard",
    summary:
      "Scholars allotted to you, RAC nominations, and requests waiting for your recommendation.",
  },
  admin: {
    title: "Admin dashboard",
    summary:
      "Admissions, allotment, RAC, payments, and the final approval after the supervisor.",
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
