import type { DownloadItem } from "@/types";

export const downloads: DownloadItem[] = [
  {
    id: "phd-form",
    title: "Ph.D. Application Form",
    description: "The official Ph.D. application form.",
    note: "DOCX",
    href: "/downloads/PhD_Application_Form.docx",
  },
  {
    id: "supervisor-form",
    title: "Supervisor Recognition Application",
    description: "Application for recognition as a research supervisor.",
    note: "DOCX",
    href: "/downloads/Supervisor_Recognition_Application.docx",
  },
  {
    id: "guidelines",
    title: "Ph.D. guidelines",
    description: "Admission, course work, and milestone overview for applicants.",
    note: "File to be uploaded",
  },
  {
    id: "regulations",
    title: "Ph.D. regulations",
    description: "The regulations that govern duration, supervision, and the thesis.",
    note: "File to be uploaded",
  },
  {
    id: "syllabus",
    title: "Course work syllabus",
    description:
      "Research Methodology, Research Publication & Ethics, and the electives.",
    note: "File to be uploaded",
  },
];
