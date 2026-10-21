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
import { formatIsoDate } from "@/lib/dates";
import {
  ensureAdmission,
  type AdmissionCase,
  type AdmissionState,
} from "@/lib/admission";
import { downloadHallTickets } from "@/lib/hall-ticket-pdf";
import { downloadPhdApplications } from "@/lib/phd-application-pdf";
import { trackPhdApplication, type PhdReceipt } from "@/lib/scholar-progress";
import { statusSchema } from "@/lib/validation";
import type { z } from "zod";

type StatusValues = z.infer<typeof statusSchema>;

export function StatusLookup() {
  const [receipt, setReceipt] = useState<PhdReceipt | null>(null);
  const [archived, setArchived] = useState(false);
  const [missed, setMissed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [ticket, setTicket] = useState<{
    row: AdmissionCase;
    office: AdmissionState;
  } | null>(null);
  const [ticketBusy, setTicketBusy] = useState(false);
  const form = useForm<StatusValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { applicationNo: "", dateOfBirth: "" },
  });
  const admitted = receipt?.status === "Admitted";
  const selected = receipt?.status === "Selected" || admitted;

  async function onSubmit(values: StatusValues) {
    setReceipt(null);
    setArchived(false);
    setMissed(false);
    setTicket(null);
    const found = await trackPhdApplication(values.applicationNo, values.dateOfBirth);
    if (found.kind === "current") {
      setReceipt(found.receipt);
      const office = await ensureAdmission().catch(() => null);
      const row = office?.cases.find(
        (item) =>
          item.applicationNo.trim().toLowerCase() ===
          found.receipt.applicationNo.trim().toLowerCase(),
      );
      if (
        office &&
        row?.shortlisted &&
        row.hallTicketNo &&
        office.progress.entranceReady
      ) {
        setTicket({ row, office });
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
      className="mx-auto max-w-xl space-y-4"
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
          {selected ? (
            <>
              <p className="mt-3 font-semibold text-secondary">
                {admitted ? scholarFormCopy.trackAdmitted : scholarFormCopy.trackSelected}
              </p>
              {admitted ? (
                <Link
                  href="/login/scholar"
                  className={buttonVariants({ variant: "gold", className: "mt-3" })}
                >
                  {scholarFormCopy.scholarLogin}
                </Link>
              ) : null}
            </>
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
