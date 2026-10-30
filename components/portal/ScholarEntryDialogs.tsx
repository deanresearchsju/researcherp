"use client";

import { useState, type ReactNode } from "react";

import { MarkFeePaidDialog, type FeeMarkRow } from "@/components/portal/MarkFeePaidDialog";
import { OfficeEntryDialog } from "@/components/portal/RacScreen";
import { RecordForm } from "@/components/portal/ScholarRecordScreen";
import { menuByKind } from "@/data/scholar-records";
import { clientToday } from "@/lib/dates";
import { feeLedger } from "@/lib/fee-ledger";
import type { ScholarRecord } from "@/lib/scholar-records";
import { useScholarReports } from "@/lib/use-report-sources";
import { usePreviewSession } from "@/lib/use-preview-session";

const detailsMenu = menuByKind("personal_details");

/**
 * What the research office enters for a scholar, from the Scholar register: the personal details,
 * the fee already paid and the RAC. Each opens the same dialog the Fee and RAC menus use, so the
 * entry shows everywhere the fee and the RAC are read. Call `details`, `fee` or `rac` from a
 * button and put `dialogs` in the page.
 */
export function useScholarEntry(onNotice: (message: string) => void) {
  const session = usePreviewSession();
  const data = useScholarReports();
  const [editing, setEditing] = useState<{
    identifier: string;
    name: string;
    record?: ScholarRecord;
  } | null>(null);
  const [feeFor, setFeeFor] = useState<{ identifier: string; name: string } | null>(null);
  const [feeRound, setFeeRound] = useState(0);
  const [feeInfo, setFeeInfo] = useState<string | null>(null);
  const [racFor, setRacFor] = useState<string | null>(null);

  const feeRows = (identifier: string, name: string): FeeMarkRow[] =>
    data.ready
      ? feeLedger(identifier, name, data.sources.payments, clientToday())
          .plan.filter((year) => year.status !== "Upcoming")
          .map((year) => ({ key: `${identifier}#${year.index}`, identifier, name, year }))
      : [];
  const racChoice = data.ready
    ? data.reports
        .filter((report) => report.guideName)
        .map((report) => ({
          identifier: report.identifier,
          name: report.name,
          supervisorIdentifier: report.guideIdentifier,
          supervisorName: report.guideName,
        }))
    : [];

  const dialogs: ReactNode = (
    <>
      {feeFor ? (
        <MarkFeePaidDialog
          key={feeRound}
          scholarName={feeFor.name}
          rows={feeRows(feeFor.identifier, feeFor.name)}
          info={feeInfo}
          onClose={() => {
            setFeeFor(null);
            setFeeInfo(null);
          }}
          onDone={(message, again) => {
            onNotice(message);
            if (again) {
              setFeeInfo(message);
              setFeeRound((value) => value + 1);
            } else {
              setFeeFor(null);
              setFeeInfo(null);
            }
          }}
        />
      ) : null}
      {racFor ? (
        <OfficeEntryDialog
          key={racFor}
          scholars={racChoice}
          initialScholar={racFor}
          defaultRecorded
          canRecord={session?.role === "admin" || session?.role === "staff"}
          onClose={() => setRacFor(null)}
          onDone={(message) => {
            onNotice(message);
            setRacFor(null);
          }}
        />
      ) : null}
      {editing ? (
        <RecordForm
          key={editing.identifier}
          officeEntry
          menu={detailsMenu}
          scholarIdentifier={editing.identifier}
          scholarName={editing.name}
          supervisorIdentifier=""
          supervisorName=""
          existing={editing.record}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            onNotice(`${editing.name}: ${message}`);
          }}
        />
      ) : null}
    </>
  );

  return {
    details: (identifier: string, name: string, record?: ScholarRecord) => {
      onNotice("");
      setEditing({ identifier, name, record });
    },
    fee: (identifier: string, name: string) => {
      onNotice("");
      setFeeInfo(null);
      setFeeRound((value) => value + 1);
      setFeeFor({ identifier, name });
    },
    /** Opens the RAC entry; false when the scholar has no guide yet. */
    rac: (identifier: string) => {
      onNotice("");
      if (!racChoice.some((item) => item.identifier === identifier)) return false;
      setRacFor(identifier);
      return true;
    },
    dialogs,
  };
}
