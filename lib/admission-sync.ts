import {
  approvalState,
  archiveYearOf,
  ensureAdmission,
  schoolNameFromLabel,
  type AdmissionCase,
} from "@/lib/admission";
import { allBatches } from "@/lib/batches";
import {
  currentDoctoral,
  enrollmentFor,
  ensureSemesterOne,
  removeScholarCourseRecords,
  saveEnrollment,
} from "@/lib/doctoral";
import {
  allocationFor,
  currentOffice,
  refreshOffice,
  removeAllocation,
  sameId,
  saveAllocation,
} from "@/lib/office";
import { sameGuide, supervisorForGuide } from "@/lib/register";
import { removePortalUser, type PortalUser, type UserSource } from "@/lib/users";
import { forgetGuideHistory } from "@/lib/guide-history";

/**
 * Takes admitted scholars out of the ERP again: their guide allotment, course enrolment,
 * semester standing and scholar sign-in. Used when an admission session is taken back.
 */
export async function purgeAdmittedRecords(
  rows: readonly AdmissionCase[],
  users: readonly PortalUser[],
  source: UserSource,
) {
  const keys = rows.flatMap((row) => [
    scholarIdentifier(users, row),
    row.email,
    row.applicationNo,
  ]);
  const wanted = (identifier: string) => keys.some((key) => sameId(identifier, key));
  if (!currentOffice()) await refreshOffice();
  for (const allocation of currentOffice()?.allocations ?? []) {
    if (wanted(allocation.scholarIdentifier)) await removeAllocation(allocation);
  }
  await forgetGuideHistory(keys);
  const removed = await removeScholarCourseRecords(keys);
  const problems: string[] = removed.ok ? [] : [removed.message];
  for (const user of users) {
    if (user.role === "scholar" && wanted(user.identifier)) {
      const done = await removePortalUser(user, source);
      if (!done.ok) problems.push(`The sign-in of ${user.name} could not be removed.`);
    }
  }
  return problems;
}

/** The scholar's own sign-in id: the account that matches, else the email. */
function scholarIdentifier(users: readonly PortalUser[], row: AdmissionCase) {
  const accounts = users.filter((item) => item.role === "scholar");
  const match =
    accounts.find((item) => sameId(item.identifier, row.email)) ??
    accounts.find((item) => sameId(item.identifier, row.applicationNo)) ??
    accounts.find((item) => sameId(item.name, row.name));
  return match?.identifier ?? row.email;
}

/** The guide's own sign-in id, so the scholar shows under that supervisor's scholars. */
function guideIdentifier(users: readonly PortalUser[], row: AdmissionCase) {
  const account = users.find(
    (user) =>
      user.role === "supervisor" &&
      (sameId(user.identifier, row.guideIdentifier) ||
        sameGuide(user.name, row.guideName)),
  );
  return (
    account?.identifier ||
    supervisorForGuide(row.guideName)?.email.trim() ||
    row.guideIdentifier ||
    row.guideName
  );
}

/**
 * Links admitted scholars to their guide and course enrolment, so the guide's "My scholars"
 * and the scholar's portal show them. A guide is allotted once the provisional list is
 * approved by the RAB / Vice Chancellor (or the documents are verified); the course
 * enrolment follows document verification. Safe to run again: it only saves what is missing.
 */
export async function syncAllotments(users: readonly PortalUser[]) {
  const admission = await ensureAdmission();
  if (!currentOffice()) await refreshOffice();
  const live = admission.cases.filter((row) => !row.sessionClosed);
  const listApproved = approvalState(admission.progress, live) === "approved";
  const doctoral = currentDoctoral();
  const batch = doctoral?.batches.find(
    (item) =>
      item.session === admission.progress.entrance.session &&
      item.year === archiveYearOf(admission.progress.entrance),
  );
  const problems: string[] = [];
  let changed = 0;
  // The fresh batch is the running intake; its scholars start in semester 1.
  const intake = admission.progress.entrance;
  const intakeBatch = allBatches().find(
    (item) =>
      item.session === intake.session &&
      String(item.year) === intake.monthYear.slice(0, 4),
  );
  const starters: { identifier: string; name: string; batchId: string }[] = [];
  for (const row of live) {
    const verified = row.verification === "Approved";
    const allotted = verified || (listApproved && row.selected && !row.reporting);
    if (!allotted) continue;
    const identifier = scholarIdentifier(users, row);
    if (row.guideName) {
      const supervisorIdentifier = guideIdentifier(users, row);
      const existing = allocationFor(currentOffice()?.allocations ?? [], identifier);
      const upToDate =
        existing &&
        sameGuide(existing.supervisorName, row.guideName) &&
        sameId(existing.supervisorIdentifier, supervisorIdentifier);
      if (!upToDate) {
        const saved = await saveAllocation({
          scholarIdentifier: identifier,
          scholarName: row.name,
          supervisorIdentifier,
          supervisorName: row.guideName,
        });
        if (saved.ok) changed += 1;
        else problems.push(saved.message);
      }
    }
    const latest = currentDoctoral();
    const enrolled = latest ? enrollmentFor(latest, identifier) : null;
    // An enrolment made without a batch is given the intake the scholar applied for.
    const needsBatch = Boolean(enrolled && !enrolled.batchId && intakeBatch);
    if (verified && latest && (!enrolled || needsBatch)) {
      await saveEnrollment({
        batchId: intakeBatch?.id ?? batch?.id ?? "",
        scholarIdentifier: identifier,
        scholarName: row.name,
        studyMode: row.studyMode,
        school: schoolNameFromLabel(row.department) || row.department,
      });
      changed += 1;
    }
    if (verified) {
      starters.push({
        identifier,
        name: row.name,
        batchId: intakeBatch?.id ?? batch?.id ?? "",
      });
    }
  }
  if (starters.length > 0) {
    const started = await ensureSemesterOne(starters);
    if (started.ok) changed += started.added;
  }
  return { changed, problems };
}
