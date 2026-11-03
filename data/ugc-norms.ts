/**
 * The Ph.D. programme as laid down in the University Grants Commission (Minimum Standards and
 * Procedure for Award of Ph.D. Degree) Regulations, 2022 (Gazette of India, 7 November 2022).
 * Summarised for applicants; no regulation numbers are shown on the website.
 */

export const ugcSource = {
  title:
    "UGC (Minimum Standards and Procedure for Award of Ph.D. Degree) Regulations, 2022",
  note: "This is a summary for applicants. The Regulations, the University's Ordinance and the current admission notification apply in full.",
};

export const ugcHighlights = [
  {
    value: "3 / 4 years",
    label: "Duration",
    detail: "Full time: 3 years · Part time: 4 years, including course work",
  },
  {
    value: "70 : 30",
    label: "Selection",
    detail: "Weightage of the entrance test to the interview",
  },
  {
    value: "12 credits",
    label: "Course work",
    detail:
      "Minimum, with Research & Publication Ethics and a research methodology course",
  },
  {
    value: "55%",
    label: "Course-work marks",
    detail: "Minimum marks (or equivalent grade) in course work",
  },
  {
    value: "2 papers",
    label: "Publications",
    detail:
      "Minimum two research papers in peer-reviewed journals before thesis submission",
  },
  {
    value: "Thesis",
    label: "Thesis submission",
    detail: "Thesis evaluation and viva-voce examination",
  },
] as const;

export const ugcEligibility = {
  title: "Who can apply",
  intro:
    "A candidate who has completed any one of the following, with the minimum marks in aggregate or the equivalent grade:",
  routes: [
    {
      id: "master-2",
      qualification: "2-year Master's degree",
      after: "after a 3-year or 4-year Bachelor's degree",
      marks: "55%",
    },
    {
      id: "master-1",
      qualification: "1-year Master's degree",
      after: "after a 5-year Bachelor's degree",
      marks: "55%",
    },
    {
      id: "bachelor-4",
      qualification: "4-year Bachelor's degree with a research component",
      after: "Qualifying in GATE, NET or a similar national-level test is mandatory",
      marks: "75%",
    },
    {
      id: "foreign",
      qualification: "Master's degree from a foreign institution",
      after: "accredited by a recognised agency within its home country",
      marks: "Equivalent",
    },
  ],
  relaxation:
    "A relaxation of 5% marks (or equivalent grade) is allowed for SC / ST / OBC (non-creamy layer), differently-abled and Economically Weaker Section candidates, and other categories as decided by the UGC.",
};

export const ugcAdmission = {
  title: "How admission is made",
  intro:
    "Admission follows the criteria notified by the University, the UGC norms and the reservation policy in force. The prospectus states the seats, the subject-wise distribution and the procedure.",
  routes: [
    {
      id: "national",
      title: "National-level tests",
      points: [
        "UGC-NET, UGC-CSIR NET, GATE, CEED and similar national tests that qualify for a fellowship or scholarship",
        "Followed by an interview",
      ],
    },
    {
      id: "entrance",
      title: "University entrance test",
      points: [
        "Syllabus: 50% research methodology and 50% subject-specific",
        "50% marks in the test to be called for the interview (5% relaxation for the reserved categories)",
      ],
    },
  ],
  selection: [
    "The number of candidates called for the interview depends on the seats available",
    "Final selection: 70% entrance test and 30% interview / viva-voce",
  ],
};

export const ugcJourney = {
  title: "From admission to the degree",
  steps: [
    {
      title: "Admission",
      detail:
        "Through a national test or the University entrance test, with an interview",
    },
    {
      title: "Course work",
      detail: "At least 12 credits with 55%; includes Research & Publication Ethics",
    },
    {
      title: "Research Advisory Committee",
      detail:
        "Reviews the proposal, fixes the topic and guides the study design; the supervisor is its convener",
    },
    {
      title: "Progress every semester",
      detail:
        "A presentation and a brief report before the Committee; its recommendations are sent to the scholar",
    },
    {
      title: "Pre-submission presentation",
      detail: "Before the thesis is submitted, open to faculty and scholars",
    },
    {
      title: "Thesis with plagiarism check",
      detail:
        "Plagiarism-detection software, the scholar's undertaking and the supervisor's certificate of originality",
    },
    {
      title: "Evaluation and viva-voce",
      detail:
        "The supervisor and two external examiners; viva-voce open to faculty, scholars and students",
    },
    {
      title: "Award",
      detail:
        "Provisional certificate; the thesis is deposited with INFLIBNET before the award is announced",
    },
  ],
};

export const ugcDuration = {
  title: "Duration, leave and modes",
  items: [
    {
      label: "Duration",
      text: "Full time: 3 years · Part time: 4 years, including course work",
    },
    {
      label: "Re-registration",
      text: "Up to 2 more years through re-registration, so that the total does not exceed 8 years",
    },
    {
      label: "Women and persons with disabilities",
      text: "A further 2 years for women scholars and persons with more than 40% disability, up to 10 years in all",
    },
    {
      label: "Maternity and child-care leave",
      text: "Up to 240 days in the whole programme for women scholars",
    },
    {
      label: "Part-time",
      text: "Permitted on the same conditions, with a no-objection certificate from the employer",
    },
    {
      label: "Mode",
      text: "Regular mode only: no Ph.D. through distance or online mode",
    },
  ],
};

export const ugcSupervision = {
  title: "Supervision",
  items: [
    {
      label: "Scholars at a time",
      text: "A Professor can guide up to 8 scholars, an Associate Professor 6 and an Assistant Professor 4",
    },
    {
      label: "International scholars",
      text: "Up to 2 more per supervisor, over and above these numbers",
    },
    {
      label: "Who can supervise",
      text: "Permanent faculty with a Ph.D. and 5 (Professor, Associate Professor) or 3 (Assistant Professor) research publications in refereed journals",
    },
    {
      label: "Co-supervisor",
      text: "A co-supervisor may be appointed, including from outside the University for interdisciplinary work",
    },
    {
      label: "Public list",
      text: "The University publishes its supervisors, their scholars and research topics, and updates the list every year",
    },
  ],
};
