"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { scholarFormCopy } from "@/data/forms";
import { referenceDate } from "@/lib/constants";
import { clientToday, formatIsoDate } from "@/lib/dates";
import {
  applicationStageOf,
  approvalState,
  ensureAdmission,
  type AdmissionCase,
  type AdmissionState,
} from "@/lib/admission";
import { downloadHallTickets } from "@/lib/hall-ticket-pdf";
import { downloadLetter } from "@/lib/letter-pdf";
import { addressLinesOf, provisionalDraft } from "@/lib/letter-templates";
import { downloadPhdApplications } from "@/lib/phd-application-pdf";
import { trackPhdApplication, type PhdReceipt } from "@/lib/scholar-progress";
import { statusSchema } from "@/lib/validation";
import type { z } from "zod";

type StatusValues = z.infer<typeof statusSchema>;

export function StatusLookup() {
  const [receipt, setReceipt] = useState<PhdReceipt | null>(null);
  const [archived, setArchived] = useState(false);
  const [resultPending, setResultPending] = useState(false);
  const [missed, setMissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [ticket, setTicket] = useState<{
    row: AdmissionCase;
    office: AdmissionState;
  } | null>(null);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [letterFile, setLetterFile] = useState<{
    row: AdmissionCase;
    office: AdmissionState;
  } | null>(null);
  const [letterBusy, setLetterBusy] = useState(false);
  const form = useForm<StatusValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { applicationNo: "", dateOfBirth: "" },
  });
  const admitted = receipt?.status === "Admitted";
  const selected = receipt?.status === "Selected" || admitted;

  async function onSubmit(values: StatusValues) {
    setReceipt(null);
    setArchived(false);
    setResultPending(false);
    setMissed(false);
    setTicket(null);
    setLetterFile(null);
    const found = await trackPhdApplication(values.applicationNo, values.dateOfBirth);
    if (found.kind === "current") {
      const office = await ensureAdmission().catch(() => null);
      const row = office?.cases.find(
        (item) =>
          item.applicationNo.trim().toLowerCase() ===
          found.receipt.applicationNo.trim().toLowerCase(),
      );
      // Once the entrance test is over and attendance is marked, the result stays "Under
      // process" until the RAB / Vice Chancellor approves the list. Admitted scholars are sent
      // to their portal.
      const admittedNow = row?.verification === "Approved";
      const listApproved = Boolean(
        office &&
        approvalState(
          office.progress,
          office.cases.filter((item) => !item.sessionClosed),
        ) === "approved",
      );
      const tested = Boolean(
        row && (row.attendance || row.selected || row.waitlistRank !== null),
      );
      const pending = Boolean(row && tested && !listApproved && !admittedNow);
      setResultPending(pending);
      const notSelected =
        Boolean(row) &&
        listApproved &&
        !admittedNow &&
        Boolean(row?.attendance) &&
        !row?.selected &&
        row?.waitlistRank === null &&
        !row?.reporting;
      setReceipt({
        ...found.receipt,
        status: pending
          ? "Under process"
          : notSelected
            ? "Not selected"
            : applicationStageOf(row, found.receipt.status),
      });
      if (pending) return;
      if (
        office &&
        row?.shortlisted &&
        row.hallTicketNo &&
        office.progress.entranceReady &&
        !row.selected &&
        !office.progress.completed.includes("entrance")
      ) {
        setTicket({ row, office });
      }
      // The provisional selection letter, once the office has issued it.
      if (office && row?.selected && row.letterIssued && !admittedNow) {
        setLetterFile({ row, office });
      }
      return;
    }
    if (found.kind === "archived") {
      setArchived(true);
      return;
    }
    setMissed(true);
  }

  async function downloadTicket() {
    if (!ticket || !receipt) return;
    setTicketBusy(true);
    try {
      await downloadHallTickets([
        {
          row: ticket.row,
          receipt,
          schedule: ticket.office.progress.entrance,
          letter: ticket.office.letter,
        },
      ]);
    } finally {
      setTicketBusy(false);
    }
  }

  async function downloadLetterFile() {
    if (!letterFile) return;
    setLetterBusy(true);
    try {
      const { office, row } = letterFile;
      await downloadLetter(
        provisionalDraft(
          row,
          office.letter,
          row.letterNo ?? 1,
          clientToday(),
          addressLinesOf(receipt?.values),
        ),
        {
          name: office.letter.deanName,
          title: office.letter.deanTitle,
          signature: office.progress.entrance.deanSignature || undefined,
        },
      );
    } finally {
      setLetterBusy(false);
    }
  }

  async function download() {
    if (!receipt || selected) return;
    setDownloading(true);
    try {
      await downloadPhdApplications([receipt]);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <form
      className="mx-auto max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <FormField
        label="Application No."
        htmlFor="applicationNo"
        required
        error={form.formState.errors.applicationNo?.message}
      >
        <Input id="applicationNo" {...form.register("applicationNo")} />
      </FormField>
      <FormField
        label="Date of Birth"
        htmlFor="status-dob"
        required
        error={form.formState.errors.dateOfBirth?.message}
      >
        <Input
          id="status-dob"
          type="date"
          max={referenceDate}
          {...form.register("dateOfBirth")}
        />
      </FormField>
      <Button type="submit" variant="gold">
        {scholarFormCopy.track}
      </Button>
      {receipt ? (
        <div
          className="rounded-xl border border-border bg-card p-4 text-sm shadow-card"
          role="status"
        >
          <p className="font-semibold text-primary">{receipt.applicationNo}</p>
          <p className="mt-1">
            {receipt.values.title} {receipt.values.fullName}
          </p>
          <p className="mt-1 text-muted-foreground">{receipt.status}.</p>
          <p className="mt-1 text-muted-foreground">
            Date of birth {formatIsoDate(receipt.values.dateOfBirth)}
          </p>
          {resultPending ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {scholarFormCopy.trackResultPending}
            </p>
          ) : null}
          {selected ? (
            <p className="mt-3 font-semibold text-secondary">
              {admitted ? scholarFormCopy.trackAdmitted : scholarFormCopy.trackSelected}
            </p>
          ) : null}
          {ticket ? (
            <div className="mt-3 rounded-lg border border-accent/50 bg-accent/10 p-3">
              <p className="font-semibold text-primary">
                {scholarFormCopy.hallTicketReady} {ticket.row.hallTicketNo}
              </p>
              <Button
                type="button"
                variant="gold"
                className="mt-2"
                disabled={ticketBusy}
                aria-busy={ticketBusy}
                onClick={() => void downloadTicket()}
              >
                {ticketBusy ? "Preparing…" : scholarFormCopy.hallTicket}
              </Button>
            </div>
          ) : null}
          {letterFile ? (
            <div className="mt-3 rounded-lg border border-accent/50 bg-accent/10 p-3">
              <p className="font-semibold text-primary">{scholarFormCopy.letterReady}</p>
              <Button
                type="button"
                variant="gold"
                className="mt-2"
                disabled={letterBusy}
                aria-busy={letterBusy}
                onClick={() => void downloadLetterFile()}
              >
                {letterBusy ? "Preparing…" : scholarFormCopy.letterDownload}
              </Button>
            </div>
          ) : null}
          {selected ? (
            <>
              {!admitted ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {letterFile
                    ? scholarFormCopy.trackSelectedNext
                    : `${scholarFormCopy.trackSelectedLetterWaiting} ${scholarFormCopy.trackSelectedNext}`}
                </p>
              ) : null}
              {admitted ? (
                <Link
                  href="/login/scholar"
                  className={buttonVariants({ variant: "gold", className: "mt-3" })}
                >
                  {scholarFormCopy.scholarLogin}
                </Link>
              ) : null}
            </>
          ) : receipt.status === "Shortlisted" ? (
            <p className="mt-3 font-semibold text-secondary">
              {ticket
                ? scholarFormCopy.trackShortlistedTicket
                : scholarFormCopy.trackShortlisted}
            </p>
          ) : receipt.status === "Not selected" ? (
            <p className="mt-3 font-semibold text-secondary">
              {scholarFormCopy.trackNotSelected}
            </p>
          ) : receipt.status === "Waiting list" || receipt.status === "Not reported" ? (
            <p className="mt-3 font-semibold text-secondary">
              {receipt.status === "Waiting list"
                ? scholarFormCopy.trackWaiting
                : scholarFormCopy.trackNotReported}
            </p>
          ) : (
            <Button
              type="button"
              variant="gold"
              className="mt-3"
              disabled={downloading}
              aria-busy={downloading}
              onClick={() => void download()}
            >
              {downloading ? "Preparing…" : scholarFormCopy.download}
            </Button>
          )}
        </div>
      ) : null}
      {archived ? (
        <p role="alert" className="text-sm text-secondary">
          {scholarFormCopy.trackArchived}
        </p>
      ) : null}
      {missed ? (
        <p role="alert" className="text-sm text-secondary">
          {scholarFormCopy.trackMissing}
        </p>
      ) : null}
    </form>
  );
}
