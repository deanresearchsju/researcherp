"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { ApprovedCopyButton } from "@/components/portal/ApprovedCopyButton";
import { MyLetters } from "@/components/portal/ConfirmationLetterPanel";
import { GateBanner, PageTitle, ViewFilesButton } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { ProfileCell } from "@/components/portal/ProfileCell";
import { scholarRecordKinds, type ScholarRecordKind } from "@/data/scholar-records";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { approvedDocuments } from "@/lib/approved-documents";
import { downloadApprovedZip } from "@/lib/approved-zip";
import { formatIsoDate } from "@/lib/dates";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import {
  currentOffice,
  sameId,
  scholarsStillGuidedBy,
  subscribeOffice,
} from "@/lib/office";
import { batchOf, scholarBySignIn, scholarSignInId } from "@/lib/register";
import {
  currentScholarRecords,
  loadRecordFile,
  subscribeScholarRecords,
  type ScholarRecord,
} from "@/lib/scholar-records";
import { usePortalSession } from "@/lib/use-preview-session";
import { useScholarProfiles } from "@/lib/use-scholar-profile";

function useRecords(kind: ScholarRecordKind) {
  return useSyncExternalStore(
    (onChange) => subscribeScholarRecords(kind, onChange),
    () => currentScholarRecords(kind),
    () => null,
  );
}

/** Loads every record kind; the kinds list is fixed, so hook order never changes. */
function useAllRecords(): ScholarRecord[] {
  const loads = scholarRecordKinds.map((kind) => useRecords(kind)); // eslint-disable-line react-hooks/rules-of-hooks
  return loads.flatMap((load) => load?.records ?? []);
}

export function ApprovedDocumentsScreen({
  mode,
}: {
  mode: "scholar" | "supervisor" | "office";
}) {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const records = useAllRecords();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [scholarFilter, setScholarFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const profile = useScholarProfiles();
  const [selected, setSelected] = useState<string[]>([]);
  const [zipping, setZipping] = useState<string | null>(null);

  if (!ready || !session || !office) {
    return <p className="text-sm text-muted-foreground">Loading approved documents…</p>;
  }

  const identifiers =
    mode === "office"
      ? null
      : mode === "scholar"
        ? [session.identifier]
        : [
            ...office.allocations
              .filter((item) => sameId(item.supervisorIdentifier, session.identifier))
              .map((item) => item.scholarIdentifier),
            ...scholarsStillGuidedBy(
              session.name,
              session.identifier,
              office.allocations,
            ).map((scholar) => scholarSignInId(scholar)),
          ];
  const all = approvedDocuments(identifiers, doctoral, records, loadRecordFile);
  const batchName = (identifier: string) => {
    const scholar = scholarBySignIn(identifier);
    return scholar ? (batchOf(scholar.batchId)?.name ?? "") : "";
  };
  const monthOf = (value: string) => value.slice(0, 7);
  const shown = all.filter(
    (item) =>
      filterMatches(typeFilter, item.title.split(" · ")[0]) &&
      filterMatches(scholarFilter, item.scholarName) &&
      filterMatches(batchFilter, batchName(item.scholarIdentifier)) &&
      filterMatches(monthFilter, monthOf(item.stamp.approvedOn || "")) &&
      profile.matches(item.scholarIdentifier) &&
      textMatches(query, [item.title, item.scholarName, item.fileName ?? ""]),
  );
  const choices = (values: string[]) =>
    [...new Set(values)]
      .filter(Boolean)
      .sort()
      .map((value) => ({ value, label: value }));

  async function zip(kind: "approved" | "original") {
    const chosen = all.filter((item) => selected.includes(item.id));
    if (chosen.length === 0) return;
    setNotice(null);
    setZipping("Preparing…");
    try {
      const result = await downloadApprovedZip(chosen, kind, (done, total) =>
        setZipping(`Preparing ${done}/${total}…`),
      );
      setNotice(
        `${chosen.length - result.skipped} file${chosen.length - result.skipped === 1 ? "" : "s"} zipped.${
          result.skipped
            ? ` ${result.skipped} had no uploaded file (office entries) and were left out.`
            : ""
        }`,
      );
    } catch {
      setNotice("The ZIP could not be prepared.");
    } finally {
      setZipping(null);
    }
  }

  return (
    <section className="space-y-6">
      <PageTitle
        kicker={
          mode === "scholar"
            ? "Scholar"
            : mode === "supervisor"
              ? "Supervisor"
              : "Dean's office"
        }
        title="Approved documents"
        actions={
          mode === "office" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={selected.length === 0 || Boolean(zipping)}
                onClick={() => void zip("original")}
              >
                <Download className="size-4" aria-hidden="true" />
                Original files (ZIP)
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={selected.length === 0 || Boolean(zipping)}
                onClick={() => void zip("approved")}
              >
                <Download className="size-4" aria-hidden="true" />
                {zipping ??
                  `Approved copies (ZIP)${selected.length ? ` · ${selected.length}` : ""}`}
              </Button>
            </>
          ) : null
        }
      />
      {notice ? (
        <p role="status" className="text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      {mode !== "office" && session ? (
        <MyLetters role={mode} identifier={session.identifier} name={session.name} />
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "type",
            label: "Document",
            value: typeFilter,
            options: choices(all.map((item) => item.title.split(" · ")[0])),
            onChange: setTypeFilter,
          },
          ...(mode !== "scholar"
            ? [
                {
                  id: "scholar",
                  label: "Scholar",
                  value: scholarFilter,
                  options: choices(all.map((item) => item.scholarName)),
                  onChange: setScholarFilter,
                },
              ]
            : []),
          ...(mode === "office"
            ? [
                {
                  id: "batch",
                  label: "Batch",
                  value: batchFilter,
                  options: choices(all.map((item) => batchName(item.scholarIdentifier))),
                  onChange: setBatchFilter,
                },
                {
                  id: "month",
                  label: "Approved in",
                  value: monthFilter,
                  options: choices(
                    all.map((item) => monthOf(item.stamp.approvedOn || "")),
                  ).reverse(),
                  onChange: setMonthFilter,
                },
              ]
            : []),
          ...(mode !== "scholar" ? profile.filters : []),
        ]}
        shown={shown.length}
        total={all.length}
        filename="approved-documents.csv"
        headers={[
          "Document",
          "Scholar",
          "Approved on",
          "Approved by",
          ...(mode !== "scholar" ? profile.headers : []),
        ]}
        rows={shown.map((item) => [
          item.title,
          item.scholarName,
          item.stamp.approvedOn,
          item.stamp.approvedBy,
          ...(mode !== "scholar" ? profile.cells(item.scholarIdentifier) : []),
        ])}
      />
      {all.length === 0 ? (
        <GateBanner>No document is approved yet.</GateBanner>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-muted text-primary">
              <tr>
                {mode === "office" ? (
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={
                        shown.length > 0 &&
                        shown.every((item) => selected.includes(item.id))
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked ? shown.map((item) => item.id) : [],
                        )
                      }
                    />
                  </th>
                ) : null}
                <th className="px-4 py-3">Document</th>
                {mode !== "scholar" ? <th className="px-4 py-3">Scholar</th> : null}
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Files</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.id} className="border-t border-border align-top">
                  {mode === "office" ? (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.title} of ${item.scholarName}`}
                        checked={selected.includes(item.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, item.id]
                              : current.filter((id) => id !== item.id),
                          )
                        }
                      />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">{item.title}</p>
                    <p className="text-muted-foreground">
                      {item.fileName || "Recorded by the office"}
                    </p>
                  </td>
                  {mode !== "scholar" ? (
                    <td className="px-4 py-3">
                      <p>{item.scholarName}</p>
                      <div className="text-xs">
                        <ProfileCell profile={profile.profileOf(item.scholarIdentifier)} />
                      </div>
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    {item.stamp.approvedOn
                      ? formatIsoDate(item.stamp.approvedOn.slice(0, 10))
                      : "—"}
                    <p className="text-muted-foreground">{item.stamp.approvedBy}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {item.fileName ? (
                        <ViewFilesButton
                          fileName={item.fileName}
                          data={item.fileData}
                          load={item.load}
                          onMissing={setNotice}
                        />
                      ) : null}
                      <ApprovedCopyButton
                        fileName={item.fileName}
                        data={item.fileData}
                        load={item.load}
                        stamp={item.stamp}
                        onError={setNotice}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
