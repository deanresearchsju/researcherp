import { university } from "@/lib/constants";

export const pageHeroes = {
  announcements: {
    eyebrow: "Notices",
    title: "Announcements",
    summary:
      "Admission windows, results, colloquia and circulars from the Center for Research.",
  },
  admission: {
    eyebrow: "Admissions",
    title: "Admission",
    summary:
      "Eligibility, the admission process and the documents you need for the Ph.D.",
  },
  supervisors: {
    eyebrow: "Supervisors",
    title: "Supervisors",
    summary:
      "Recognised research supervisors by school, with the seats open this session.",
  },
  team: {
    eyebrow: university.researchOffice,
    title: "Our Team",
    summary: "The Dean and the research office who support every scholar and supervisor.",
  },
  downloads: {
    eyebrow: "Library",
    title: "Downloads",
    summary: "Regulations, forms and formats for scholars and supervisors.",
  },
  journey: {
    eyebrow: "Scholars",
    title: "Scholar journey",
    summary:
      "Every milestone from admission and course work to synopsis, thesis and viva.",
  },
  contact: {
    eyebrow: "Helpdesk",
    title: "Contact",
    summary: "Write to or visit the Center for Research. We reply on working days.",
  },
  apply: {
    eyebrow: "Admissions",
    title: "PhD Application",
    summary:
      "Fill in the application, upload your documents and pay the application fee.",
  },
  applyStatus: {
    eyebrow: "Admissions",
    title: "Track application",
    summary: "Check your application status and download your hall ticket.",
  },
  supervisorApply: {
    eyebrow: "Supervisors",
    title: "Supervisor recognition",
    summary: "Apply for recognition as a research supervisor of St. Joseph University.",
  },
  supervisorStatus: {
    eyebrow: "Supervisors",
    title: "Supervisor application status",
    summary: "Track a recognition application and download the recognition letter.",
  },
  terms: {
    eyebrow: "Legal",
    title: "Terms",
    summary: "Terms that apply to the use of this website and the research portal.",
  },
} as const;
