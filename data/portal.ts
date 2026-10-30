import { incompleteApplicationsCopy } from "@/data/incomplete-applications";
import { registrationCopy } from "@/data/registration";
import type { Notice, PortalNavGroup, Role } from "@/types";

const record = (role: Role, slug: string, label: string) => ({
  label,
  href: `/${role}/records/${slug}`,
  ready: true,
});

export const portalModules = {
  admissions: "Admissions",
  registers: "Registers",
  supervision: "Supervision",
  scholarRecords: "Scholar records",
  requests: "Requests",
  courseWork: "Course work",
  examination: "Examination",
  doctoralProgress: "Doctoral progress",
  website: "Website",
  reports: "Letters & reports",
  administration: "Administration",
  accounts: "Fee verification",
  scholars: "Scholars",
  fees: "Fees",
  approvals: "Approvals",
  documents: "Documents",
} as const;

export const menuRightsCopy = {
  title: "Submenu rights",
  hint: "Tick each module submenu this sign-in may open. Download / export and upload stay off until you tick them. Only the administrator sign-in keeps every option.",
  selectAll: "All submenus",
  clear: "Clear",
  grantWork: "Admission work menus",
  groupAll: "All in this module",
  dashboardOnly: "Dashboard only",
  allMenus: "All menus",
} as const;

export const officeWorkHrefs = [
  "/admin/dashboard",
  "/admin/admission",
  "/admin/vacancies",
  "/admin/applications",
  "/admin/incomplete-applications",
  "/admin/registration-numbers",
] as const;

const admissionArchiveItem = {
  label: "Admission archive",
  href: "/admin/admission-archive",
  ready: true,
};

const requestItems = (role: Role) => [
  record(role, "supervisor-change", "Supervisor change"),
  record(role, "study-mode-change", "Full-time to part-time"),
  record(role, "title-change", "Title change"),
  record(role, "leave", "Leave"),
  record(role, "extension", "Extension"),
  record(role, "phd-cancellation", "Ph.D. cancellation"),
];

const doctoralItems = (role: "admin" | "scholar") => [
  // The scholar sees the Research Advisory Committee first: it is formed before the first meeting.
  ...(role === "scholar"
    ? [{ label: "RAC members", href: "/scholar/rac", ready: true }]
    : []),
  { label: "First committee", href: `/${role}/dc-first`, ready: true },
  { label: "Ph.D. confirmation", href: `/${role}/confirmation`, ready: true },
  { label: "Colloquium", href: `/${role}/colloquium`, ready: true },
  record(role, "publications", "Publications"),
  { label: "Six-month report", href: `/${role}/reports`, ready: true },
  { label: "Third committee", href: `/${role}/dc-third`, ready: true },
  { label: "Plagiarism check", href: `/${role}/plagiarism`, ready: true },
  { label: "Synopsis", href: `/${role}/synopsis`, ready: true },
  ...(role === "admin"
    ? [{ label: "Thesis evaluators", href: "/admin/evaluators", ready: true }]
    : []),
  { label: "Thesis", href: `/${role}/thesis`, ready: true },
  // Examiner reports are for the research office only; scholars do not see them.
  ...(role === "admin"
    ? [{ label: "Examiner reports", href: "/admin/examiner-reports", ready: true }]
    : []),
  { label: "Viva", href: `/${role}/viva`, ready: true },
  { label: "Completion", href: `/${role}/completion`, ready: true },
];

const adminGroups: PortalNavGroup[] = [
  {
    heading: "",
    items: [{ label: "Dashboard", href: "/admin/dashboard", ready: true }],
  },
  {
    heading: portalModules.admissions,
    items: [
      { label: "Application window", href: "/admin/site", ready: true },
      { label: "Vacancies", href: "/admin/vacancies", ready: true },
      {
        label: incompleteApplicationsCopy.menu,
        href: "/admin/incomplete-applications",
        ready: true,
      },
      { label: "Applications", href: "/admin/applications", ready: true },
      { label: "Selection", href: "/admin/admission", ready: true },
      {
        label: "Entrance invigilation",
        href: "/admin/entrance-invigilation",
        ready: true,
      },
    ],
  },
  {
    heading: portalModules.registers,
    items: [
      { label: "Scholar register", href: "/admin/register", ready: true },
      { label: "Scholar information", href: "/admin/scholar-info", ready: true },
      { label: "Supervisor register", href: "/admin/supervisors", ready: true },
      { label: "Passed-out scholars", href: "/admin/passed-out", ready: true },
    ],
  },
  {
    heading: portalModules.examination,
    items: [
      {
        label: registrationCopy.menu,
        href: "/admin/registration-numbers",
        ready: true,
      },
      { label: "Registration windows", href: "/admin/course-windows", ready: true },
      { label: "Course registrations", href: "/admin/course-work", ready: true },
      { label: "Semester promotion", href: "/admin/promotions", ready: true },
      { label: "Exam setup", href: "/admin/exam-setup", ready: true },
      { label: "Hall tickets & seating", href: "/admin/exam-tickets", ready: true },
      { label: "Invigilation duty", href: "/admin/invigilation", ready: true },
      { label: "Results", href: "/admin/results", ready: true },
      { label: "Mark entry", href: "/admin/coe/marks", ready: true },
      { label: "Verify & freeze marks", href: "/admin/coe/verify", ready: true },
      { label: "Result approval", href: "/admin/exam-results", ready: true },
    ],
  },
  {
    heading: portalModules.doctoralProgress,
    items: doctoralItems("admin"),
  },
  {
    heading: portalModules.supervision,
    items: [
      { label: "Scholar allotment", href: "/admin/allocations", ready: true },
      { label: "RAC", href: "/admin/rac", ready: true },
      { label: "Supervisor transfer", href: "/admin/transfers", ready: true },
      { label: "Supervisor exit", href: "/admin/supervisor-exit", ready: true },
    ],
  },
  {
    heading: portalModules.requests,
    items: requestItems("admin"),
  },
  {
    heading: portalModules.fees,
    items: [
      { label: "Tuition fees", href: "/admin/fee", ready: true },
      { label: "Fee approvals", href: "/admin/payments", ready: true },
    ],
  },
  {
    heading: portalModules.scholarRecords,
    items: [
      record("admin", "abc-id", "ABC ID"),
      { label: "Approved documents", href: "/admin/approved", ready: true },
      { label: "Attendance sheets", href: "/admin/attendance", ready: true },
    ],
  },
  {
    heading: portalModules.reports,
    items: [
      { label: "Letters", href: "/admin/letters", ready: true },
      { label: "Reports & downloads", href: "/admin/erp-reports", ready: true },
      { label: "Forms & formats", href: "/admin/forms", ready: true },
    ],
  },
  {
    heading: portalModules.website,
    items: [
      { label: "News and events", href: "/admin/news", ready: true },
      { label: "Helpdesk", href: "/admin/helpdesk", ready: true },
      { label: "Research areas", href: "/admin/research-areas", ready: true },
      { label: "Our Team", href: "/admin/team", ready: true },
      { label: "Supervisor profiles", href: "/admin/supervisor-profiles", ready: true },
    ],
  },
  {
    heading: portalModules.administration,
    items: [
      { label: "Users", href: "/admin/users", ready: true },
      { label: "Approval rules", href: "/admin/approval-rules", ready: true },
      { label: "Fee settings", href: "/admin/fee-settings", ready: true },
      { label: "Audit trail", href: "/admin/audit", ready: true },
      { label: "Clear test data", href: "/admin/test-data", ready: true },
    ],
  },
];

/** Menus only the administrator has, however rights are granted to the others. */
const adminOnlyHrefs = new Set(["/admin/test-data", "/admin/audit"]);

function officeGroups(withArchive: boolean, administrator = false): PortalNavGroup[] {
  return adminGroups.map((group) => {
    const items = administrator
      ? group.items
      : group.items.filter((item) => !adminOnlyHrefs.has(item.href));
    if (group.heading !== portalModules.admissions) return { ...group, items };
    return {
      ...group,
      items: withArchive ? [...items, admissionArchiveItem] : items,
    };
  });
}

export const portalGroups: Record<Role, PortalNavGroup[]> = {
  scholar: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/scholar/dashboard", ready: true }],
    },
    {
      heading: portalModules.courseWork,
      items: [
        { label: "Registration", href: "/scholar/course-work", ready: true },
        { label: "Hall ticket", href: "/scholar/exam-hall-ticket", ready: true },
        { label: "Results", href: "/scholar/results", ready: true },
      ],
    },
    {
      heading: portalModules.doctoralProgress,
      items: doctoralItems("scholar"),
    },
    {
      heading: portalModules.requests,
      items: requestItems("scholar"),
    },
    {
      heading: portalModules.scholarRecords,
      items: [
        record("scholar", "personal-details", "My details"),
        record("scholar", "abc-id", "ABC ID"),
        { label: "Vidwan ID", href: "/scholar/vidwan-id", ready: true },
        { label: "Fee", href: "/scholar/fee", ready: true },
        { label: "Approved documents", href: "/scholar/approved", ready: true },
        { label: "Forms & formats", href: "/scholar/forms", ready: true },
        { label: "Helpdesk", href: "/scholar/helpdesk", ready: true },
      ],
    },
  ],
  supervisor: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/supervisor/dashboard", ready: true }],
    },
    {
      heading: portalModules.scholars,
      items: [
        { label: "My details", href: "/supervisor/details", ready: true },
        { label: "My scholars", href: "/supervisor/scholars", ready: true },
      ],
    },
    {
      heading: portalModules.approvals,
      items: [
        { label: "Scholar requests", href: "/supervisor/reviews", ready: true },
        { label: "Doctoral committees", href: "/supervisor/committees", ready: true },
        { label: "Synopsis & thesis", href: "/supervisor/submissions", ready: true },
      ],
    },
    {
      heading: portalModules.supervision,
      items: [
        { label: "RAC proposal", href: "/supervisor/rac", ready: true },
        { label: "Thesis evaluators", href: "/supervisor/evaluators", ready: true },
        { label: "Colloquium", href: "/supervisor/colloquium", ready: true },
      ],
    },
    {
      heading: portalModules.documents,
      items: [
        { label: "Approved documents", href: "/supervisor/approved", ready: true },
        { label: "Forms & formats", href: "/supervisor/forms", ready: true },
        { label: "Helpdesk", href: "/supervisor/helpdesk", ready: true },
      ],
    },
  ],
  admin: officeGroups(true, true),
  staff: officeGroups(false),
  dean: officeGroups(true),
  accounts: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/admin/dashboard", ready: true }],
    },
    {
      // The same screen the research office uses under Fees: one place to check every fee.
      heading: portalModules.fees,
      items: [{ label: "Fee approvals", href: "/admin/payments", ready: true }],
    },
  ],
  coe: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/admin/dashboard", ready: true }],
    },
    {
      heading: portalModules.examination,
      items: [{ label: "Marks entry", href: "/admin/coe/marks", ready: true }],
    },
  ],
  coeverify: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/admin/dashboard", ready: true }],
    },
    {
      heading: portalModules.examination,
      items: [{ label: "Verify & freeze marks", href: "/admin/coe/verify", ready: true }],
    },
  ],
  vc: [
    {
      heading: "",
      items: [{ label: "Dashboard", href: "/admin/dashboard", ready: true }],
    },
    {
      heading: portalModules.registers,
      items: [
        { label: "Scholar register", href: "/admin/register", ready: true },
        { label: "Supervisor register", href: "/admin/supervisors", ready: true },
      ],
    },
    {
      heading: portalModules.doctoralProgress,
      items: [
        { label: "RAC approval", href: "/admin/rac", ready: true },
        { label: "Thesis evaluators", href: "/admin/evaluators", ready: true },
      ],
    },
  ],
};

/**
 * Every menu the administrator may give to a sign-in of a role. A role's own menus
 * (portalGroups) are what it starts with; the administrator can add any other menu of the
 * research office to any office sign-in (Accounts, the Vice Chancellor and the Controllers of
 * Examinations included) and take any away. Clearing test data stays with the main administrator.
 */
function mergeGroups(groups: readonly PortalNavGroup[]): PortalNavGroup[] {
  const seen = new Set<string>();
  const merged: PortalNavGroup[] = [];
  for (const group of groups) {
    const items = group.items.filter((item) => {
      if (seen.has(item.href)) return false;
      seen.add(item.href);
      return true;
    });
    if (items.length === 0) continue;
    const same = merged.find((entry) => entry.heading === group.heading);
    if (same) same.items = [...same.items, ...items];
    else merged.push({ ...group, items });
  }
  return merged;
}

export const grantableGroups: Record<Role, PortalNavGroup[]> = Object.fromEntries(
  (Object.keys(portalGroups) as Role[]).map((role) => {
    if (role === "scholar" || role === "supervisor") return [role, portalGroups[role]];
    return [
      role,
      mergeGroups([
        ...portalGroups[role],
        ...officeGroups(true, role === "admin"),
        ...portalGroups.accounts,
        ...portalGroups.coe,
        ...portalGroups.coeverify,
        ...portalGroups.vc,
      ]),
    ];
  }),
) as Record<Role, PortalNavGroup[]>;

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
  accounts: {
    title: "Accounts dashboard",
    summary:
      "Check each receipt and verify the registration, course-work registration and annual fee payments.",
  },
  coe: {
    title: "Controller of Examinations · Marks entry",
    summary:
      "Enter the course-work marks subject by subject, campus by campus or batch by batch, then send them for verification.",
  },
  coeverify: {
    title: "Controller of Examinations · Verification",
    summary:
      "Check the marks entered, freeze them (a frozen mark cannot be changed), print the sheet for your records and submit it to the research office.",
  },
  vc: {
    title: "Vice Chancellor dashboard",
    summary:
      "The scholar and supervisor registers, and the thesis evaluators the Dean has forwarded for your selection.",
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
