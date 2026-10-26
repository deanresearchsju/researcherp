/**
 * What the University provides to its scholars besides the degree itself: the similarity check,
 * the stipend and the research information network. The research office edits the wording here.
 */
export const researchSupport = {
  eyebrow: "Support for scholars",
  title: "Research integrity, stipend and visibility",
  items: [
    {
      id: "drillbit",
      title: "DrillBit similarity check",
      lead: "Every thesis is checked with the DrillBit plagiarism-detection software.",
      points: [
        "A similarity check is made before the synopsis and again before the thesis is submitted.",
        "The Research Office issues a similarity certificate; the synopsis or thesis can be submitted only after it is issued.",
        "The scholar's undertaking and the supervisor's certificate of originality go with the thesis.",
      ],
    },
    {
      id: "stipend",
      title: "Stipend for full-time scholars",
      lead: "Full-time Ph.D. scholars are eligible for a stipend.",
      points: [
        "The amount and the conditions are notified by the University for each session.",
        "Full-time scholars may be assigned 4 to 6 hours a week of teaching or research assistantship.",
      ],
      // Fill in the monthly amount to show it on the page.
      amount: "",
    },
    {
      id: "irins",
      title: "IRINS research profile",
      lead: "Scholars and supervisors keep their research profile on IRINS, the Indian Research Information Network System of INFLIBNET.",
      points: [
        "Publications, projects and patents are recorded in one place.",
        "The profile makes the research output visible to other institutions and funders.",
      ],
    },
  ],
};
