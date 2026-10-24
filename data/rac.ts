import { university } from "@/lib/constants";

export const racMemo = {
  title: "Nomination for Doctoral Committee External Panel Member",
  addressee: ["Dean Research", university.name, "Tindivanam - 604307", "Tamil Nadu"],
  salutation: "Dear Sir,",
  opening:
    "This memo serves to nominate one candidate from the following list for the Doctoral Committee External Panel:",
  closing: "One member will be selected by the Dean.",
} as const;

export const racCopy = {
  kicker: "Research Advisory Committee",
  supervisorTitle: "RAC proposal",
  officeTitle: "RAC decisions",
  scholarTitle: "RAC members",
  supervisorIntro:
    "Every scholar allotted to you needs a RAC. Name two internal members and two external members, each with designation, department, institution, email, phone and specialisation. The Dean approves one internal member and one external member; the RAC is then shown to you and to the scholar.",
  changeRule:
    "Once the Dean constitutes the RAC, a change can be requested after six months. Give the reason for the change.",
  notConstituted: "RAC not constituted",
  waiting: "Waiting for the Dean's selection",
  constituted: "RAC constituted",
  initiate: "Initiate RAC",
  edit: "Edit nomination",
  requestChange: "Request change",
  printMemo: "Nomination memo",
  internalLabel: (index: number) => `Internal member ${index}`,
  externalLabel: (index: number) => `External panel candidate ${index}`,
  deanOnly:
    "Only the Dean (or the administrator) selects the members. You can read the nominations here.",
  noScholars: "No scholar is allotted to you yet. RAC follows allotment.",
} as const;
