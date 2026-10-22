"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { referenceDate } from "@/lib/constants";
import { clientToday, formatIsoDate } from "@/lib/dates";
import { ensureAdmission, type AdmissionState } from "@/lib/admission";
import { downloadLetter } from "@/lib/letter-pdf";
import { recognitionDraft } from "@/lib/letter-templates";
import { lookupSupervisorApplication, type StoredApplication } from "@/lib/records";
import { recognitionOf } from "@/lib/supervisor-approval";
import { supervisorReceiptFromApplication } from "@/lib/supervisor-application";
import { downloadSupervisorApplications } from "@/lib/supervisor-application-pdf";

function stageOf(application: StoredApplication) {
  if (application.status === "Approved" && recognitionOf(application.payload)) {
    return {
      title: "Recognised as a research supervisor",
      detail:
        "The Research Advisory Board / Vice Chancellor has approved your recognition. Download the recognition letter below.",
    };
  }
  if (application.status === "Rejected") {
    return {
      title: "Not recognised",
      detail:
        "Your application was not approved. Please contact the Center for Research.",
    };
  }
  if (application.status === "Accepted" || application.status === "Approved") {
    return {
      title: "Eligibility verified",
      detail:
        "Your eligibility has been verified. The application is with the Research Advisory Board / Vice Chancellor for approval.",
    };
  }
  return {
    title: "Application received",
    detail:
      "Your application is with the Center for Research for verification of the eligibility conditions.",
  };
}

export function SupervisorStatusLookup() {
  const [applicationNo, setApplicationNo] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{
    application: StoredApplication;
    office: AdmissionState | null;
  } | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFound(null);
    if (!applicationNo.trim() || !dateOfBirth) {
      setError("Enter the application number and the date of birth.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const application = await lookupSupervisorApplication(applicationNo, dateOfBirth);
      if (!application) {
        setError(
          "No supervisor application matches that number and date of birth. Check both and try again.",
        );
        return;
      }
      const office = await ensureAdmission().catch(() => null);
      setFound({ application, office });
    } finally {
      setBusy(false);
    }
  }

  async function downloadRecognition() {
    if (!found) return;
    setFileBusy(true);
    try {
      const { application, office } = found;
      const letter = office?.letter;
      await downloadLetter(recognitionDraft(null, application, clientToday()), {
        name: letter?.deanName ?? "",
        title: letter?.deanTitle ?? "",
        signature: office?.progress.entrance.deanSignature || undefined,
      });
    } finally {
      setFileBusy(false);
    }
  }

  async function downloadApplication() {
    if (!found) return;
    setFileBusy(true);
    try {
      await downloadSupervisorApplications([
        supervisorReceiptFromApplication(found.application),
      ]);
    } finally {
      setFileBusy(false);
    }
  }

  const stage = found ? stageOf(found.application) : null;
  const recognised =
    found?.application.status === "Approved" &&
    recognitionOf(found.application.payload) !== null;

  return (
    <form
      className="mx-auto max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7"
      onSubmit={onSubmit}
      noValidate
    >
      <FormField label="Application No." htmlFor="sup-status-no" required>
        <Input
          id="sup-status-no"
          value={applicationNo}
          onChange={(event) => setApplicationNo(event.target.value)}
        />
      </FormField>
      <FormField label="Date of Birth" htmlFor="sup-status-dob" required>
        <Input
          id="sup-status-dob"
          type="date"
          max={referenceDate}
          value={dateOfBirth}
          onChange={(event) => setDateOfBirth(event.target.value)}
        />
      </FormField>
      <Button type="submit" variant="gold" disabled={busy} aria-busy={busy}>
        {busy ? "Checking…" : "Track application"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      {found && stage ? (
        <div
          className="rounded-xl border border-border bg-card p-4 text-sm shadow-card"
          role="status"
        >
          <p className="font-semibold text-primary">{found.application.applicationNo}</p>
          <p className="mt-1">{found.application.applicantName}</p>
          <p className="mt-1 text-muted-foreground">
            Submitted on {formatIsoDate(found.application.createdAt.slice(0, 10))}
          </p>
          <p className="mt-3 font-semibold text-secondary">{stage.title}</p>
          <p className="mt-1 text-muted-foreground">{stage.detail}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recognised ? (
              <Button
                type="button"
                variant="gold"
                disabled={fileBusy}
                onClick={() => void downloadRecognition()}
              >
                {fileBusy ? "Preparing…" : "Download recognition letter"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={fileBusy}
              onClick={() => void downloadApplication()}
            >
              Download application
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
