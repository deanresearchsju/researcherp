import type { Milestone } from "@/types";

export const courseWork = {
  deadline: "Course work must be completed within 2 years (4 semesters).",
  semesters: [
    {
      name: "Semester 1",
      papers: ["Research Methodology", "Research Publication & Ethics"],
    },
    {
      name: "Semester 2",
      papers: ["Elective", "Major"],
    },
  ],
};

export const milestones: Milestone[] = [
  {
    id: "dc1",
    title: "First DC",
    detail: "The doctoral committee is constituted and the supervisor is allotted.",
  },
  {
    id: "coursework",
    title: "Course work",
    detail:
      "Semester 1: Research Methodology, Research Publication & Ethics. Semester 2: Elective and Major.",
  },
  {
    id: "colloquium",
    title: "Colloquium",
    detail: "Present in the May or November colloquium window.",
  },
  {
    id: "dc2",
    title: "Second DC",
    detail: "Ph.D. confirmation after the committee reviews progress.",
  },
  {
    id: "publications",
    title: "Publications",
    detail: "Record the publications required before the synopsis is accepted.",
  },
  {
    id: "dc3",
    title: "Third DC",
    detail: "The committee reviews the research ahead of the synopsis.",
  },
  {
    id: "synopsis",
    title: "Synopsis",
    detail: "Submit the synopsis once publications and prior meetings are in order.",
  },
  {
    id: "dc4",
    title: "Fourth DC",
    detail: "The committee considers the synopsis and the path to submission.",
  },
  {
    id: "thesis",
    title: "Thesis",
    detail: "Submit the thesis for evaluation as notified by the research office.",
  },
];
