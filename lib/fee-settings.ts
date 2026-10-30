"use client";

import { useSyncExternalStore } from "react";

import { defaultLetter } from "@/data/admission";
import { adminActionBlock } from "@/lib/access";
import { withAudit } from "@/lib/audit";
import {
  currentAdmission,
  ensureAdmission,
  saveAdmission,
  subscribeAdmission,
  type LetterConfig,
} from "@/lib/admission";

/**
 * The fees fixed by the administrator under Fee settings. They are kept with the admission
 * letter settings, so every page that shows a fee (the public site, the application, the
 * provisional letter, the scholar's fee pages, Accounts) reads the same figures and a change
 * appears everywhere at once.
 */
export type FeeSettings = {
  application: number;
  fullTime: number;
  partTime: number;
  synopsis: number;
  thesis: number;
  /** Mark sheet fee, charged once with each course-work registration (besides the paper fees). */
  markSheet: number;
};

type FeeLetter = Pick<
  LetterConfig,
  | "applicationFee"
  | "fullTimeFee"
  | "partTimeFee"
  | "synopsisFee"
  | "thesisFee"
  | "markSheetFee"
>;

function amount(value: string | undefined, fallback: string) {
  const number = Number((value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(number) && (value ?? "") !== "" ? number : Number(fallback);
}

export function feesFromLetter(letter: Partial<FeeLetter>): FeeSettings {
  return {
    application: amount(letter.applicationFee, defaultLetter.applicationFee),
    fullTime: amount(letter.fullTimeFee, defaultLetter.fullTimeFee),
    partTime: amount(letter.partTimeFee, defaultLetter.partTimeFee),
    synopsis: amount(letter.synopsisFee, defaultLetter.synopsisFee),
    thesis: amount(letter.thesisFee, defaultLetter.thesisFee),
    markSheet: amount(letter.markSheetFee, defaultLetter.markSheetFee),
  };
}

export function currentFees(): FeeSettings {
  return feesFromLetter(currentAdmission()?.letter ?? defaultLetter);
}

/** The fees, refreshed on screen when the administrator changes them. */
export function useFees(): FeeSettings {
  const admission = useSyncExternalStore(
    subscribeAdmission,
    currentAdmission,
    () => null,
  );
  return feesFromLetter(admission?.letter ?? defaultLetter);
}

export function rupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

/** The administrator sets the fees (0 means no fee for a synopsis or thesis). */
async function saveFeeSettingsRaw(fees: FeeSettings) {
  const blocked = adminActionBlock();
  if (blocked) return blocked;
  const current = await ensureAdmission();
  return saveAdmission({
    cases: current.cases,
    letter: {
      ...current.letter,
      applicationFee: String(Math.max(0, Math.round(fees.application))),
      fullTimeFee: String(Math.max(0, Math.round(fees.fullTime))),
      partTimeFee: String(Math.max(0, Math.round(fees.partTime))),
      synopsisFee: String(Math.max(0, Math.round(fees.synopsis))),
      thesisFee: String(Math.max(0, Math.round(fees.thesis))),
      markSheetFee: String(Math.max(0, Math.round(fees.markSheet))),
    },
  });
}

/* The changes below are written in the audit trail. */
export const saveFeeSettings = withAudit(saveFeeSettingsRaw, () => ({
  action: "fee-settings:saved",
  subject: "fee-settings",
  detail: "Fee amounts were changed",
}));
