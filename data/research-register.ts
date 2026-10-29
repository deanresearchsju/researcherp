export type ResearchBatch = {
  id: string;
  name: string;
  session: string;
  year: number;
  order: number;
  needsRegistrationNumber: boolean;
  note: string;
};

export type ResearchSupervisor = {
  serialNo: number;
  name: string;
  supervisorId: string;
  department: string;
  designation: string;
  researchArea: string;
  active: boolean;
  currentScholars: number;
  quota: number;
  vacancy: number;
  june2026Allotment: number;
  balance: number;
  campus: string;
  phone: string;
  email: string;
  onVacancyList: boolean;
};

export type ResearchScholar = {
  id: string;
  serialNo: number;
  registrationNumber: string;
  fileNumber: string;
  applicationNumber: string;
  name: string;
  department: string;
  batchId: string;
  phone: string;
  email: string;
  title: string;
  category: string;
  institution: string;
  guideName: string;
  firstDc: string;
  secondDc: string;
  confirmation: string;
  colloquium1: string;
  colloquium2: string;
  synopsis: string;
  thesis: string;
  viva: string;
};

/**
 * The batches of scholars. The scholars and supervisors themselves are NOT kept in the code:
 * the code is downloaded by every visitor of the website, and the register holds names, mobile
 * numbers and e-mail addresses. They are stored in the database (research_register, id "seed";
 * see scripts/seed-register.mjs) and put into this object by applyRegisterSeed() after sign-in.
 */
export const researchRegister = {
  batches: [
    {
      id: "2025-january",
      name: "January 2025",
      session: "January",
      year: 2025,
      order: 1,
      needsRegistrationNumber: false,
      note: "Registration numbers are allotted.",
    },
    {
      id: "2025-june",
      name: "July 2025",
      session: "July",
      year: 2025,
      order: 2,
      needsRegistrationNumber: false,
      note: "Registration numbers are allotted.",
    },
    {
      id: "2026-january",
      name: "January 2026",
      session: "January",
      year: 2026,
      order: 3,
      needsRegistrationNumber: true,
      note: "Selected. The file number is on the register. The registration number is still to be allotted.",
    },
    {
      id: "2026-june",
      name: "July 2026",
      session: "July",
      year: 2026,
      order: 4,
      needsRegistrationNumber: true,
      note: "Newly selected. Admission is complete. The registration number is still to be allotted.",
    },
  ],
  supervisors: [],
  scholars: [],
} as {
  batches: ResearchBatch[];
  supervisors: ResearchSupervisor[];
  scholars: ResearchScholar[];
};
