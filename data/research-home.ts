/** Wording from the University research page, through Ph.D. Regulations: https://sju.ac.in/research/ */

export const researchPage = {
  title: "Research",
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
  durationLabel: "Duration",
  duration: ["Full Time: 3 to 6 years", "Part-Time: 4 to 7 years"],
  creditsLabel: "Course Work Credits",
  credits: "12",
  marksLabel: "Course Work Marks / CGPA",
  marks: "55% / 5.8",
  extensions: [
    "Re-registration: 2 years extension (maximum 8 years total)",
    "Female/PWD: 2 years additional extension (maximum 10 years total)",
    "Maternity/Child Care Leave: Up to 240 days",
  ],
  teaching:
    "Teaching/Pedagogy Training: Mandatory for all Ph.D. scholars, involving 4-6 hours/week of teaching/research assistantship.",
  onlineCourses:
    "UGC-recognized online courses may be included, as per the Recommendation of the Research Advisory Committee",
  nationalTitle: "National Level Tests:",
  nationalTests: "UGC-NET/CSIR-NET/GATE/CEED etc. followed by an interview.",
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
  { id: "supervisor", label: "Supervisor" },
  { id: "evaluation", label: "Evaluation Process" },
] as const;

export type RegulationTabId = (typeof regulationTabs)[number]["id"];

export const regulationEligibility = {
  headers: ["Degree", "Marks", "5% Relaxation"],
  row: ["MASTER'S/M.Phil.", "55%", "SC/ST/OBC/PWD/EWS"],
};

export const regulationSupervisors = {
  headers: ["Designation", "Eligibility", "Scholar Limit"],
  rows: [
    ["Professor", "PhD + 5 Research Publications", "8"],
    ["Associate Professor", "PhD + 5 Research Publications", "6"],
    ["Assistant Professor", "PhD + 3 Research Publications", "4"],
  ],
};

export const regulationEvaluation = {
  steps: [
    "Coursework",
    "Submission of Synopsis",
    "Draft Thesis Presentation",
    "Thesis Submission",
  ],
  notes: [
    "Thesis Evaluation by the supervisor and 2 external examiners (one preferably from outside India).",
    "Viva-voce Examination, Open to RAC members, faculty, and scholars.",
    "Evaluation Timeline: The entire evaluation process must be completed within 6 months of thesis submission.",
  ],
};

export const regulationsTitle = "Ph.D. Regulations";
