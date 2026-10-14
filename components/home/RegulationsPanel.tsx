"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  regulationEligibility,
  regulationEvaluation,
  regulationTabs,
  researchPage,
  type RegulationTabId,
} from "@/data/research-home";

export function RegulationsPanel() {
  const [tab, setTab] = useState<RegulationTabId>("eligibility");

  return (
    <div>
      <div
        className="inline-flex max-w-full flex-wrap overflow-hidden rounded-xl border border-border bg-card"
        role="tablist"
        aria-label="Ph.D. Regulations"
      >
        {regulationTabs.map((item, index) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            role="tab"
            aria-selected={tab === item.id}
            variant={tab === item.id ? "default" : "ghost"}
            className={cn(
              "rounded-none",
              index > 0 && "border-l border-border",
              tab !== item.id && "text-foreground",
            )}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="mt-4" role="tabpanel">
        {tab === "eligibility" ? (
          <FactTable headers={regulationEligibility.headers} rows={[regulationEligibility.row]} />
        ) : null}
        {tab === "admission" ? <AdmissionCopy /> : null}
        {tab === "evaluation" ? (
          <div className="space-y-3 text-sm leading-6">
            <ol className="list-decimal space-y-1 pl-5">
              {regulationEvaluation.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {regulationEvaluation.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AdmissionCopy() {
  return (
    <div className="space-y-3 text-sm leading-6">
      <p className="font-semibold text-primary">{researchPage.nationalTitle}</p>
      <p>{researchPage.nationalTests}</p>
      <p className="font-semibold text-primary">{researchPage.entranceTitle}</p>
      <ul className="list-disc space-y-1 pl-5">
        {researchPage.entrancePoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="font-semibold text-primary">{researchPage.weightage}</p>
    </div>
  );
}

function FactTable({
  headers,
  rows,
}: {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead className="bg-muted text-primary">
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col" className="px-4 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")} className="border-t border-border">
              {row.map((cell) => (
                <td key={cell} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
