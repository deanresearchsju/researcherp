import { researchRegister, type ResearchBatch } from "@/data/research-register";
import { currentAdmission } from "@/lib/admission";
import { currentSiteSettings, parsePhdSession } from "@/lib/office";

/**
 * Every batch the ERP knows: the batches on the register plus each new intake as soon as its
 * application window is opened (the application window, the running selection, and closed
 * sessions in the archive). A new batch therefore appears wherever batches are chosen.
 */
export function allBatches(): ResearchBatch[] {
  const base = researchRegister.batches;
  const intakes = new Map<string, { session: "January" | "July"; year: number }>();
  const add = (month: string, year: string) => {
    const number = Number(year);
    if (!Number.isInteger(number) || number < 2000) return;
    const session = month === "July" ? "July" : "January";
    intakes.set(`${number}-${session === "July" ? "june" : "january"}`, {
      session,
      year: number,
    });
  };

  const settings = currentSiteSettings();
  if (settings?.admissionSession) {
    const open = parsePhdSession(settings.admissionSession);
    add(open.month, open.year);
  }
  const admission = currentAdmission();
  if (admission) {
    const entrance = admission.progress.entrance;
    if (entrance.session && entrance.monthYear) {
      add(entrance.session, entrance.monthYear.slice(0, 4));
    }
    for (const archived of admission.archived) add(archived.session, archived.year);
    // Intakes whose selection is finished stay listed through their admitted scholars.
    for (const row of admission.cases) {
      const [year, kind] = row.intake.split("-");
      if (year && kind) add(kind === "june" ? "July" : "January", year);
    }
  }

  const known = new Set(base.map((batch) => batch.id));
  let order = Math.max(0, ...base.map((batch) => batch.order));
  const extra: ResearchBatch[] = [...intakes.entries()]
    .filter(([id]) => !known.has(id))
    .sort(
      ([, left], [, right]) =>
        left.year - right.year || (left.session === "January" ? -1 : 1),
    )
    .map(([id, intake]) => {
      order += 1;
      return {
        id,
        name: `${intake.session} ${intake.year}`,
        session: intake.session,
        year: intake.year,
        order,
        needsRegistrationNumber: true,
        note: "New intake. Enter the registration numbers given by the Controller of Examinations; each is permanent once recorded.",
      };
    });
  return [...base, ...extra];
}

/** A batch by id, including a new intake that is not on the register yet. */
export function batchById(batchId: string) {
  if (!batchId) return null;
  return allBatches().find((batch) => batch.id === batchId) ?? null;
}

/** The intake an admitted scholar belongs to: the stamped one, else the running selection's. */
export function intakeOfCase(
  admission: ReturnType<typeof currentAdmission>,
  row: { intake: string },
) {
  if (row.intake) return row.intake;
  const entrance = admission?.progress.entrance;
  return entrance?.session && entrance.monthYear
    ? intakeId(entrance.session, entrance.monthYear.slice(0, 4))
    : "";
}

export function isRegisterBatch(batchId: string) {
  return researchRegister.batches.some((batch) => batch.id === batchId);
}

function intakeId(session: string, year: string | number) {
  return `${year}-${session === "July" ? "june" : "january"}`;
}

/** Admitted (document-verified) scholars of one intake: the running selection or an archived one. */
export function intakeCasesOf(
  admission: ReturnType<typeof currentAdmission>,
  batchId: string,
) {
  if (!admission) return [];
  const entrance = admission.progress.entrance;
  const current =
    entrance.session && entrance.monthYear
      ? intakeId(entrance.session, entrance.monthYear.slice(0, 4))
      : "";
  const rows = [
    ...(current === batchId ? admission.cases.filter((row) => !row.sessionClosed) : []),
    ...admission.cases.filter((row) => row.sessionClosed && row.intake === batchId),
    ...admission.archived
      .filter((item) => intakeId(item.session, item.year) === batchId)
      .flatMap((item) => item.cases),
  ];
  return rows.filter((row) => row.verification === "Approved");
}
