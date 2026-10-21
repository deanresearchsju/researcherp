export const officeActionCopy = {
  transfer: {
    kicker: "Supervision",
    title: "Supervisor transfer",
    detail:
      "Move selected scholars from the present supervisor to another recognised supervisor. Vacancy is checked before the transfer is saved.",
    fromLabel: "Present supervisor",
    toLabel: "New supervisor",
    submit: "Transfer selected",
    empty: "No scholar matches that supervisor.",
  },
  promotion: {
    kicker: "Course work",
    title: "Semester promotion",
    detail:
      "Only an administrator can promote or demote a scholar. Select a batch, tick scholars, then choose the next semester to promote or an earlier semester to demote. Promotion moves one semester at a time. Once a scholar moves on, registration and submissions for the earlier semester close.",
    batchLabel: "Batch",
    semesterLabel: "Map to semester",
    promote: "Promote selected",
    demote: "Demote selected",
    empty: "Select a batch to list its scholars.",
    noneEligiblePromote:
      "None of the selected scholars can be promoted to that semester. Promotion moves one semester at a time, so choose the semester right after the one they hold now.",
    noneEligibleDemote:
      "None of the selected scholars can be demoted to that semester. Choose an earlier semester than they hold now.",
  },
} as const;
