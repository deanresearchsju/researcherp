"use client";

import { useMemo, useSyncExternalStore } from "react";

import { clientToday } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { currentOffice, subscribeOffice } from "@/lib/office";
import {
  currentAllotments,
  currentExits,
  currentPassedOut,
  currentQuotas,
  currentStandings,
  subscribeRegister,
} from "@/lib/register";
import {
  scholarReport,
  type ReportSources,
  type ScholarReport,
} from "@/lib/scholar-report";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { guideOptions, scholarRows, type GuideOption } from "@/lib/supervision";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";

function useRecords(kind: "payment" | "six_month_report" | "publication") {
  return useSyncExternalStore(
    (onChange) => subscribeScholarRecords(kind, onChange),
    () => currentScholarRecords(kind),
    () => null,
  );
}

/** Everything the colloquium and report screens read, joined into one report per scholar. */
export function useScholarReports():
  | { ready: false }
  | {
      ready: true;
      reports: ScholarReport[];
      guides: GuideOption[];
      sources: ReportSources;
    } {
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const users = useSyncExternalStore(
    subscribePortalUsers,
    currentPortalUsers,
    () => null,
  );
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const standings = useSyncExternalStore(
    subscribeRegister,
    currentStandings,
    currentStandings,
  );
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  const exits = useSyncExternalStore(subscribeRegister, currentExits, currentExits);
  const passedOut = useSyncExternalStore(
    subscribeRegister,
    currentPassedOut,
    currentPassedOut,
  );
  const payments = useRecords("payment");
  const sixMonth = useRecords("six_month_report");
  const publications = useRecords("publication");

  return useMemo(() => {
    if (!doctoral || !office) return { ready: false as const };
    const sources: ReportSources = {
      doctoral,
      proposals: office.proposals,
      payments: payments?.records ?? [],
      sixMonth: sixMonth?.records ?? [],
      publications: publications?.records ?? [],
      today: clientToday(),
    };
    const reports = scholarRows(office.allocations, allotments).map((row) =>
      scholarReport(row, sources),
    );
    const guides = guideOptions(
      office.allocations,
      users?.users ?? [],
      quotas,
      standings,
    );
    return { ready: true as const, reports, guides, sources };
    // exits and passed-out scholars change the rows through the register store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    doctoral,
    office,
    users,
    quotas,
    standings,
    allotments,
    exits,
    passedOut,
    payments,
    sixMonth,
    publications,
  ]);
}
