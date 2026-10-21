"use client";

import { useSyncExternalStore } from "react";

import { personFileCopy } from "@/data/person-file";
import { Button } from "@/components/ui/button";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import {
  downloadScholarPersonFile,
  downloadSupervisorPersonFile,
  scholarPersonSections,
  supervisorPersonSections,
} from "@/lib/person-file";
import { currentApplications, subscribeApplications } from "@/lib/records";
import { currentAllotments, subscribeRegister } from "@/lib/register";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { isOfficeRole } from "@/lib/access";
import { useCanMenuAction } from "@/lib/use-menu-action";
import { usePreviewSession } from "@/lib/use-preview-session";

export function PersonalDetailsPanel({
  role,
  identifier,
  name,
}: {
  role: "scholar" | "supervisor";
  identifier: string;
  name: string;
}) {
  const own = usePreviewSession();
  const applications = useSyncExternalStore(
    subscribeApplications,
    currentApplications,
    () => null,
  );
  useSyncExternalStore(
    (onChange) => subscribeScholarRecords("personal_details", onChange),
    () => currentScholarRecords("personal_details"),
    () => null,
  );
  useSyncExternalStore(subscribeRegister, currentAllotments, currentAllotments);
  useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const sections =
    role === "scholar"
      ? scholarPersonSections(identifier, name, applications ?? [])
      : supervisorPersonSections(identifier, name, applications ?? []);
  const canDownloadScholar = useCanMenuAction("export", "/admin/register");
  const canDownloadSupervisor = useCanMenuAction("export", "/admin/supervisors");
  // Only the research office downloads a person's file; scholars and supervisors download
  // approved documents only.
  const canDownload =
    Boolean(own && isOfficeRole(own.role)) &&
    (role === "scholar" ? canDownloadScholar : canDownloadSupervisor);

  return (
    <section className="mt-6 rounded-xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">
          {role === "scholar"
            ? personFileCopy.scholarTitle
            : personFileCopy.supervisorTitle}
        </h2>
        {canDownload ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-readonly-allow=""
            onClick={() =>
              role === "scholar"
                ? downloadScholarPersonFile(identifier, name)
                : downloadSupervisorPersonFile(identifier, name)
            }
          >
            {personFileCopy.downloadOne}
          </Button>
        ) : null}
      </div>
      {applications === null ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Loading personal details…
        </p>
      ) : sections.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{personFileCopy.empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {sections.map((item) => (
            <div key={item.heading} className="px-4 py-4">
              <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {item.heading}
              </h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {item.pairs.map((pair) => (
                  <div key={`${item.heading}-${pair.label}`}>
                    <dt className="text-xs text-muted-foreground">{pair.label}</dt>
                    <dd className="mt-1 text-sm font-medium break-words text-primary">
                      {pair.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
