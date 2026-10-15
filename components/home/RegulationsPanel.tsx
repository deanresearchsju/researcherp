"use client";

import {
  Award,
  ClipboardList,
  FileSearch,
  GraduationCap,
  ListChecks,
  Percent,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  regulationEligibility,
  regulationEvaluation,
  regulationTabs,
  researchPage,
  type RegulationTabId,
} from "@/data/research-home";

const tabIcons: Record<RegulationTabId, LucideIcon> = {
  eligibility: GraduationCap,
  admission: ClipboardList,
  evaluation: ListChecks,
};

const eligibilityIcons: LucideIcon[] = [GraduationCap, Percent];

const evaluationNoteIcons: LucideIcon[] = [FileSearch, Users, Timer];

export function RegulationsPanel() {
  const [tab, setTab] = useState<RegulationTabId>("eligibility");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-card lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <div className="border-b border-border bg-muted/50 p-3 lg:border-r lg:border-b-0 lg:p-4">
        <div
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
          role="tablist"
          aria-label="Ph.D. Regulations"
        >
          {regulationTabs.map((item) => {
            const Icon = tabIcons[item.id];
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`regulation-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`regulation-panel-${item.id}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  selected
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "bg-card text-primary hover:bg-muted lg:bg-transparent",
                )}
                onClick={() => setTab(item.id)}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    selected ? "bg-primary-foreground/15" : "bg-muted text-primary",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`regulation-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`regulation-tab-${tab}`}
        className="p-5 sm:p-7"
      >
        {tab === "eligibility" ? <EligibilityCopy /> : null}
        {tab === "admission" ? <AdmissionCopy /> : null}
        {tab === "evaluation" ? <EvaluationCopy /> : null}
      </div>
    </div>
  );
}

function EligibilityCopy() {
  const { headers, row } = regulationEligibility;

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {headers.map((header, index) => {
        const Icon = eligibilityIcons[index] ?? GraduationCap;
        return (
          <div
            key={header}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 pt-6"
          >
            <div className="absolute inset-x-0 top-0 flex h-1.5" aria-hidden="true">
              <span className="w-14 bg-accent" />
              <span className="flex-1 bg-gradient-to-r from-primary to-purple-deep" />
            </div>
            <dt className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
              <span className="grid size-8 place-items-center rounded-lg bg-muted text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {header}
            </dt>
            <dd className="mt-3 font-heading text-2xl leading-snug text-primary">
              {row[index]}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function AdmissionCopy() {
  return (
    <div className="space-y-4">
      <article className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
            <Award className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h4 className="font-heading text-lg text-primary">
              {researchPage.nationalTitle}
            </h4>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {researchPage.nationalTests}
            </p>
          </div>
        </div>
      </article>

      <p className="relative flex items-center justify-center">
        <span className="absolute inset-x-6 h-px bg-border" aria-hidden="true" />
        <span className="relative rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold tracking-[0.2em] text-secondary">
          {researchPage.admissionOr}
        </span>
      </p>

      <article className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
            <ClipboardList className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h4 className="font-heading text-lg text-primary">
              {researchPage.entranceTitle}
            </h4>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {researchPage.entrancePoints.map((point) => (
                <li key={point} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      <p className="rounded-2xl border border-border bg-muted/60 px-5 py-4 text-sm font-semibold leading-6 text-primary">
        {researchPage.weightage}
      </p>
    </div>
  );
}

function EvaluationCopy() {
  return (
    <div className="space-y-6">
      <ol className="grid gap-3 sm:grid-cols-2">
        {regulationEvaluation.steps.map((step, index) => (
          <li
            key={step}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <p className="pt-1.5 font-semibold text-primary">{step}</p>
          </li>
        ))}
      </ol>
      <ul className="space-y-3">
        {regulationEvaluation.notes.map((note, index) => {
          const Icon = evaluationNoteIcons[index] ?? FileSearch;
          return (
            <li
              key={note}
              className="flex gap-3 rounded-2xl border border-border bg-muted/40 p-4"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <p className="pt-1.5 text-sm leading-6 text-muted-foreground">{note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
