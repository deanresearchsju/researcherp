"use client";

import { useCallback, useMemo, useState } from "react";

import type { ListFilter } from "@/components/portal/ListToolbar";
import { isPartTimeMode } from "@/lib/constants";
import { filterMatches } from "@/lib/list-filter";
import { scholarBySignIn, supervisorForGuide } from "@/lib/register";
import { useScholarReports } from "@/lib/use-report-sources";

export type ScholarProfile = {
  department: string;
  campus: string;
  guide: string;
  mode: string;
  /** Registration number, or the file number before one is given. */
  registration: string;
};

const noProfile: ScholarProfile = {
  department: "",
  campus: "",
  guide: "",
  mode: "",
  registration: "",
};

/** The headings the profile adds to a scholar list, in the order `cells` returns them. */
export const profileHeaders = ["Department", "Campus", "Guide", "Mode"] as const;

/** A scholar who is no longer on the active lists (passed out, exited) is read from the register. */
function registerProfile(identifier: string): ScholarProfile {
  const scholar = scholarBySignIn(identifier);
  if (!scholar) return noProfile;
  return {
    department: scholar.department,
    campus: supervisorForGuide(scholar.guideName)?.campus ?? "",
    guide: scholar.guideName,
    mode: isPartTimeMode(scholar.category) ? "Part time" : "Full time",
    registration: scholar.registrationNumber || scholar.fileNumber,
  };
}

const distinct = (values: readonly string[]) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

/**
 * Department, campus, guide and mode of every scholar, with the four filters that go with them.
 * A scholar list adds `filters` to its toolbar, drops rows that fail `matches`, and puts
 * `headers` and `cells` into the table and the Excel / PDF export. `onChange` lets the list go
 * back to its first page when a filter is touched.
 */
export function useScholarProfiles(
  onChange?: () => void,
  /** A list that already has its own guide column and filter leaves the profile's out. */
  options: { omitGuide?: boolean } = {},
) {
  const { omitGuide = false } = options;
  const load = useScholarReports();
  const [department, setDepartment] = useState("");
  const [campus, setCampus] = useState("");
  const [guide, setGuide] = useState("");
  const [mode, setMode] = useState("");

  const reports = load.ready ? load.reports : null;
  const byId = useMemo(
    () =>
      new Map<string, ScholarProfile>(
        (reports ?? []).map((report) => [
          report.identifier.trim().toLowerCase(),
          {
            department: report.department,
            campus: report.campus,
            guide: report.guideName,
            mode: report.mode,
            registration: report.registration,
          },
        ]),
      ),
    [reports],
  );

  const profileOf = useCallback(
    (identifier: string | undefined): ScholarProfile =>
      byId.get((identifier ?? "").trim().toLowerCase()) ??
      registerProfile(identifier ?? ""),
    [byId],
  );

  const matches = useCallback(
    (identifier: string | undefined) => {
      if (!department && !campus && !guide && !mode) return true;
      const profile = profileOf(identifier);
      return (
        filterMatches(department, profile.department) &&
        filterMatches(campus, profile.campus) &&
        filterMatches(guide, profile.guide) &&
        filterMatches(mode, profile.mode)
      );
    },
    [department, campus, guide, mode, profileOf],
  );

  const cells = useCallback(
    (identifier: string | undefined): string[] => {
      const profile = profileOf(identifier);
      return omitGuide
        ? [profile.department, profile.campus, profile.mode]
        : [profile.department, profile.campus, profile.guide, profile.mode];
    },
    [profileOf, omitGuide],
  );

  const filters = useMemo<ListFilter[]>(() => {
    const all = [...byId.values()];
    const option = (values: readonly string[]) =>
      distinct(values).map((value) => ({ value, label: value }));
    const set = (apply: (value: string) => void) => (value: string) => {
      apply(value);
      onChange?.();
    };
    const list: ListFilter[] = [
      {
        id: "department",
        label: "Department",
        value: department,
        options: option(all.map((item) => item.department)),
        onChange: set(setDepartment),
      },
      {
        id: "campus",
        label: "Campus",
        value: campus,
        options: option(all.map((item) => item.campus)),
        onChange: set(setCampus),
      },
      {
        id: "guide",
        label: "Guide",
        value: guide,
        options: option(all.map((item) => item.guide)),
        onChange: set(setGuide),
      },
      {
        id: "mode",
        label: "Mode",
        value: mode,
        options: option(all.map((item) => item.mode)),
        onChange: set(setMode),
      },
    ];
    return omitGuide ? list.filter((item) => item.id !== "guide") : list;
  }, [byId, department, campus, guide, mode, onChange, omitGuide]);

  return {
    ready: load.ready,
    filters,
    matches,
    cells,
    profileOf,
    headers: omitGuide ? profileHeaders.filter((item) => item !== "Guide") : profileHeaders,
  };
}
