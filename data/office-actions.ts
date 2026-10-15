export const officeActionCopy = {
  transfer: {
    kicker: "Research office",
    title: "Supervisor transfer",
    detail:
      "Move selected scholars from the present supervisor to another recognised supervisor. Vacancy is checked before the transfer is saved.",
    fromLabel: "Present supervisor",
    toLabel: "New supervisor",
    submit: "Transfer selected",
    empty: "No scholar matches that supervisor.",
  },
  promotion: {
    kicker: "Research office",
    title: "Semester promotion",
    detail:
      "Select a batch, tick scholars on the list, then map them to a semester. That semester appears on every scholar page.",
    batchLabel: "Batch",
    semesterLabel: "Map to semester",
    submit: "Promote selected",
    empty: "Select a batch to list its scholars.",
  },
} as const;
