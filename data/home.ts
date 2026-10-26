export const admissionWindow = {
  label: "Admissions open",
  session: "January 2027",
  deadlineLabel: "Last Date to Apply",
  deadline: "",
};

export const homeCopy = {
  programmesLink: "View full details",
  admissionLink: "Ph.D. admission",
};

export const phdWindowCopy = {
  eyebrow: "Admissions",
  title: "Ph.D. application window",
  description:
    "Open or close online Ph.D. applications. There are two sessions each year: January and July. Set the current session, year, and last date shown on the public site.",
  open: "Open applications",
  close: "Close applications",
  openStatus: "Applications are open",
  closedStatus: "Admissions are currently closed",
  session: "Open admission session",
  year: "Year",
  label: "Status label",
  deadlineLabel: "Last-date label",
  deadline: "Last date",
  deadlineHint: "Shown on the application window preview and the apply page when closed.",
  save: "Save window",
  saved: "Ph.D. application window saved.",
  opened: "Ph.D. applications are now open.",
  closed: "Ph.D. applications are now closed.",
  preview: "Public site will show",
  closedDetail:
    "The application portal will open soon. Ph.D. admissions open twice a year, in January and July.",
} as const;

export const supervisorWindowCopy = {
  title: "Supervisor recognition",
  description: "Open or close applications for recognition as a research supervisor.",
  open: "Open recognition",
  close: "Close recognition",
  openStatus: "Recognition is open",
  closedStatus: "Recognition is closed",
  opened: "Supervisor recognition is now open.",
  closed: "Supervisor recognition is now closed.",
} as const;
