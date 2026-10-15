import { university } from "@/lib/constants";

/** Wording from the University research page, through Ph.D. Regulations: https://sju.ac.in/research/ */

export const researchPage = {
  title: university.researchOffice,
  badge: "Research · Innovation · Impact",
  summary:
    "SJU fosters a dynamic research culture focused on innovation, industry collaboration, and real-world impact. With multidisciplinary initiatives, state-of-the-art facilities, and a commitment to societal progress, SJU empowers researchers to develop solutions that shape the future.",
  programmesTitle: "Ph.D. Programmes",
  programmes: [
    "Humanities & Social Sciences",
    "Engineering & Technology",
    "Medicine & Allied Health Sciences",
    "Management Sciences",
    "LAW",
  ],
  highlightsTitle: "Research Programme Highlights",
  highlights: [
    {
      id: "duration",
      label: "Duration",
      points: [
        "Full Time: 3 to 6 years",
        "Part-Time Internal: 4 to 7 years",
        "Part-Time External: 4 to 7 years",
      ],
    },
    {
      id: "course-work",
      label: "Course work",
      value: "12 credits · 55% / 5.5 CGPA",
      detail:
        "UGC-recognized online courses may be included for Course work, as per the Recommendation of the Research Advisory Committee.",
    },
    {
      id: "re-registration",
      label: "Re-registration",
      value: "2 years extension",
    },
    {
      id: "additional-extension",
      label: "Female / PWD",
      value: "2 years additional extension",
    },
    {
      id: "maternity",
      label: "Maternity / Child Care Leave",
      value: "Up to 240 days",
    },
    {
      id: "teaching",
      label: "Teaching / Pedagogy Training",
      detail:
        "Mandatory for all Full-Time Ph.D. scholars, involving 4–6 hours/week of teaching/research assistantship.",
    },
  ],
  durationLabel: "Duration",
  duration: [
    "Full Time: 3 to 6 years",
    "Part-Time Internal: 4 to 7 years",
    "Part-Time External: 4 to 7 years",
  ],
  programmeModes: [
    {
      id: "full-time",
      title: "Full Time",
      duration: "3 to 6 years",
      points: [
        "The doctorate is the primary academic commitment.",
        "Course work is completed within four semesters.",
        "Regular contact with the allotted supervisor.",
        "Progress through doctoral committee meetings, colloquium, publications, synopsis, and the thesis.",
      ],
    },
    {
      id: "part-time-internal",
      title: "Part-Time Internal",
      duration: "4 to 7 years",
      points: [
        "For candidates associated with the University.",
        "Work experience and a no-objection certificate from the present employer.",
        "Course work is completed within four semesters.",
        "The same milestone sequence as full-time scholars.",
      ],
    },
    {
      id: "part-time-external",
      title: "Part-Time External",
      duration: "4 to 7 years",
      points: [
        "For candidates based outside the University.",
        "Work experience and a no-objection certificate from the present employer.",
        "Course work is completed within four semesters.",
        "The same milestone sequence as full-time scholars.",
      ],
    },
  ],
  creditsLabel: "Course Work Credits",
  credits: "12",
  marksLabel: "Course Work Marks / CGPA",
  marks: "55% / 5.5",
  onlineCourses:
    "UGC-recognized online courses may be included for Course work, as per the Recommendation of the Research Advisory Committee.",
  nationalTitle: "National Level Tests:",
  nationalTests: "UGC-NET/CSIR-NET/GATE/CEED etc. followed by an interview.",
  admissionOr: "OR",
  entranceTitle: "Institution Level Entrance Test:",
  entrancePoints: [
    "Syllabus & Weightage: 50% Research Methodology,",
    "50% Subject-Specific.",
    "50% marks for eligibility to interview.",
    "5% marks relaxation for SC/ST/OBC/PWD/EWS.",
  ],
  weightage: "70% weightage to the entrance test, 30% to the interview.",
};

export const regulationTabs = [
  { id: "eligibility", label: "General Eligibility" },
  { id: "admission", label: "Admission Procedure" },
  { id: "evaluation", label: "Evaluation Process" },
] as const;

export type RegulationTabId = (typeof regulationTabs)[number]["id"];

export const regulationEligibility = {
  headers: ["Degree", "Marks"],
  row: ["MASTER'S", "55%"],
};

export const regulationEvaluation = {
  steps: [
    "Coursework",
    "Colloquium",
    "Comprehensive",
    "Seminar Presentation",
    "Submission of Synopsis",
    "Thesis Presentation",
    "Viva Voce",
  ],
  notes: [
    "Thesis Evaluation by the supervisor and 2 external examiners (one preferably from outside India).",
    "Viva-voce Examination, Open to RAC members, faculty, and scholars.",
    "Evaluation Timeline: The entire evaluation process will be completed within 6 months of thesis submission.",
  ],
};

export const regulationsTitle = "Ph.D. Regulations";
