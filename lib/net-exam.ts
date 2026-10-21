import { netExamCopy } from "@/data/forms";
import { isNetQualified, netIncludesNet, netIncludesSet } from "@/lib/constants";

export type NetExamValues = {
  netQualified: string;
  netRoll: string;
  netYear: string;
  netAgency: string;
  setRoll: string;
  setYear: string;
  setAgency: string;
};

function examLine(label: string, roll: string, year: string, agency: string) {
  return [label, roll, year, agency]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

export function formatNetQualification(values: NetExamValues, empty = "—") {
  if (!isNetQualified(values.netQualified)) {
    return values.netQualified.trim() || empty;
  }
  const parts: string[] = [];
  if (netIncludesNet(values.netQualified)) {
    parts.push(
      examLine(netExamCopy.net, values.netRoll, values.netYear, values.netAgency),
    );
  }
  if (netIncludesSet(values.netQualified)) {
    parts.push(
      examLine(netExamCopy.set, values.setRoll, values.setYear, values.setAgency),
    );
  }
  return parts.join("  |  ") || values.netQualified || empty;
}
