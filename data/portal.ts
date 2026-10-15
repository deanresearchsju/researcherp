import { registrationCopy } from "@/data/registration";
import type { Notice, PortalNavGroup, Role } from "@/types";

const record = (role: Role, slug: string, label: string) => ({
  label,
  href: `/${role}/records/${slug}`,
  ready: true,
});

export const menuRightsCopy = {
  title: "Submenu rights",
  hint: "The list follows the role you selected. Tick the submenus this sign-in may open. Dashboard stays on.",
  selectAll: "All submenus",
  clear: "Clear",
  groupAll: "All in this menu",
  dashboardOnly: "Dashboard only",
  allMenus: "All menus",
} as const;

export const officeWorkHrefs = [
  "/admin/dashboard",
  "/admin/admission",
  "/admin/entrance-marks",
  "/admin/vacancies",
  "/admin/applications",
  "/admin/registration-numbers",
] as const;

const admissionArchiveItem = {
  label: "Admission archive",
  href: "/admin/admission-archive",
  ready: true,
};

const adminGroups: PortalNavGroup[] = [
  {
    heading: "",
    items: [{ label: "Dashboard", href: "/admin/dashboard", ready: true }],
  },
  {
    heading: "Office",
    items: [
      { label: "Application window", href: "/admin/site", ready: true },
      { label: "News and events", href: "/admin/news", ready: true },
      { label: "Research areas", href: "/admin/research-areas", ready: true },
      { label: "Scholar register", href: "/admin/register", ready: true },
      { label: "Supervisor register", href: "/admin/supervisors", ready: true },
      { label: "Users", href: "/admin/users", ready: true },
      { label: "Payment approvals", href: "/admin/payments", ready: true },
      { label: "Our Team", href: "/admin/team", ready: true },
    ],
  },
  {
    heading: "Admissions",
    items: [
      { label: "Selection", href: "/admin/admission", ready: true },
      { label: "Entrance marks", href: "/admin/entrance-marks", ready: true },
      { label: "Scholar allotment", href: "/admin/allocations", ready: true },
      {
        label: registrationCopy.menu,
        href: "/admin/registration-numbers",
        ready: true,
      },
      { label: "Supervisor transfer", href: "/admin/transfers", ready: true },
      { label: "Vacancies", href: "/admin/vacancies", ready: true },
      { label: "Applications", href: "/admin/applications", ready: true },
      { label: "RAC", href: "/admin/rac", ready: true },
    ],
  },
  {
    heading: "Scholar records",
    items: [
      record("admin", "abc-id", "ABC ID"),
      record("admin", "hall-ticket", "Hall ticket"),
      record("admin", "payment-history", "Payment history"),
    ],
  },
  {
    heading: "Requests",
    items: [
      record("admin", "phd-cancellation", "Ph.D. cancellation"),
      record("admin", "supervisor-change", "Supervisor change"),
      record("admin", "study-mode-change", "Full-time to part-time"),
      record("admin", "leave", "Leave"),
      record("admin", "extension", "Extension"),
      record("admin", "title-change", "Title change"),
    ],
  },
  {
    heading: "Course work",
    items: [
      { label: "Registration", href: "/admin/course-work", ready: true },
      { label: "Semester promotion", href: "/admin/promotions", ready: true },
      { label: "Results", href: "/admin/results", ready: true },
    ],
  },
  {
    heading: "Doctoral progress",
    items: [
      { label: "First committee", href: "/admin/dc-first", ready: true },
      { label: "Ph.D. confirmation", href: "/admin/confirmation", ready: true },
      { label: "Colloquium", href: "/admin/colloquium", ready: true },
      record("admin", "publications", "Publications"),
      { label: "Six-month report", href: "/admin/reports", ready: true },
      { label: "Third committee", href: "/admin/dc-third", ready: true },
      { label: "Synopsis", href: "/admin/synopsis", ready: true },
      { label: "Fourth committee", href: "/admin/dc-fourth", ready: true },
      { label: "Thesis", href: "/admin/thesis", ready: true },
      { label: "Plagiarism", href: "/admin/plagiarism", ready: true },
      { label: "Examiner reports", href: "/admin/examiner-reports", ready: true },
      { label: "Viva", href: "/admin/viva", ready: true },
      { label: "Completion", href: "/admin/completion", ready: true },
    ],
  },
];

export const portalGroups: Record<Role, PortalNavGroup[]> = {
  scholar: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/scholar/dashboard", ready: true }],
    },
    {
      heading: "Admission",
      items: [{ label: "Admission file", href: "/scholar/admission", ready: true }],
    },
    {
      heading: "Personal record",
      items: [
        record("scholar", "abc-id", "ABC ID"),
        record("scholar", "hall-ticket", "Hall ticket"),
        record("scholar", "payment-history", "Payment history"),
      ],
    },
    {
      heading: "Requests",
      items: [
        record("scholar", "phd-cancellation", "Ph.D. cancellation"),
        record("scholar", "supervisor-change", "Supervisor change"),
        record("scholar", "study-mode-change", "Full-time to part-time"),
        record("scholar", "leave", "Leave"),
        record("scholar", "extension", "Extension"),
        record("scholar", "title-change", "Title change"),
      ],
    },
    {
      heading: "Course work",
      items: [
        { label: "Registration", href: "/scholar/course-work", ready: true },
        { label: "Results", href: "/scholar/results", ready: true },
      ],
    },
    {
      heading: "Doctoral progress",
      items: [
        { label: "First committee", href: "/scholar/dc-first", ready: true },
        { label: "Ph.D. confirmation", href: "/scholar/confirmation", ready: true },
        { label: "Colloquium", href: "/scholar/colloquium", ready: true },
        record("scholar", "publications", "Publications"),
        { label: "Six-month report", href: "/scholar/reports", ready: true },
        { label: "Third committee", href: "/scholar/dc-third", ready: true },
        { label: "Synopsis", href: "/scholar/synopsis", ready: true },
        { label: "Fourth committee", href: "/scholar/dc-fourth", ready: true },
        { label: "Thesis", href: "/scholar/thesis", ready: true },
        { label: "Plagiarism", href: "/scholar/plagiarism", ready: true },
        { label: "Examiner reports", href: "/scholar/examiner-reports", ready: true },
        { label: "Viva", href: "/scholar/viva", ready: true },
        { label: "Completion", href: "/scholar/completion", ready: true },
        { label: "RAC members", href: "/scholar/rac", ready: true },
      ],
    },
  ],
  supervisor: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/supervisor/dashboard", ready: true }],
    },
    {
      heading: "Scholars",
      items: [
        { label: "My scholars", href: "/supervisor/scholars", ready: true },
        { label: "Scholar requests", href: "/supervisor/reviews", ready: true },
      ],
    },
    {
      heading: "Committee",
      items: [
        { label: "RAC proposal", href: "/supervisor/rac", ready: true },
        { label: "Colloquium", href: "/supervisor/colloquium", ready: true },
      ],
    },
  ],
  admin: officeGroups(true),
  staff: officeGroups(false),
  dean: officeGroups(true),
};

function officeGroups(withArchive: boolean): PortalNavGroup[] {
  return adminGroups.map((group) => {
    if (group.heading !== "Admissions") return group;
    return {
      ...group,
      items: withArchive ? [...group.items, admissionArchiveItem] : group.items,
    };
  });
}

export const portalShellCopy = {
  workspace: "workspace",
  active: "Active",
  assistanceTitle: "Need assistance?",
  assistanceDetail: "Write to the research office for ERP support.",
} as const;

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
      "Monitor admissions, allotment, and registers. Unlock a blocked step only to correct an error.",
  },
  staff: {
    title: "Staff dashboard",
    summary:
      "Complete the open admission step. View full applications and receipts before you move on.",
  },
  dean: {
    title: "Dean dashboard",
    summary:
      "Monitor admissions as staff complete each step. Changes to a blocked step stay with the administrator.",
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
