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
    "Every scholar allotted to you needs a RAC. Name 1 to 3 internal members and 2 to 3 external members, each with designation, institution, address, email, contact number, area of research (no publication details are asked). The Dean selects one internal and one external member and the Vice Chancellor gives the final approval; the RAC is then shown to you and to the scholar.",
  changeRule:
    "Once the Dean constitutes the RAC, a change can be requested after six months. Give the reason for the change.",
  notConstituted: "RAC not constituted",
  waiting: "Waiting for the Dean's selection",
  withVc: "With the Vice Chancellor for the final approval",
  constituted: "RAC constituted",
  initiate: "Initiate RAC",
  edit: "Edit nomination",
  requestChange: "Request change",
  printMemo: "Nomination memo",
  internalLabel: (index: number) => `Internal member ${index}`,
  externalLabel: (index: number) => `External panel candidate ${index}`,
  deanOnly:
    "Only the person who selects the members (the Dean, or the Vice Chancellor when the Dean's step is switched off in Approval rules) decides here. You can read the nominations.",
  noScholars: "No scholar is allotted to you yet. RAC follows allotment.",
} as const;
