"use client";

import { useState } from "react";
import Link from "next/link";

import { SupervisorApplicationSheet } from "@/components/forms/supervisor/SupervisorApplicationSheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { applicationReviewCopy } from "@/data/application-review";
import { supervisorFormCopy } from "@/data/forms";
import type { SupervisorReceipt } from "@/lib/supervisor-application";
import { downloadSupervisorApplications } from "@/lib/supervisor-application-pdf";

export type { SupervisorReceipt };

export function SupervisorReceiptView({ receipt }: { receipt: SupervisorReceipt }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  return (
    <div>
      <div className="no-print mb-6 text-center">
        <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
          Application submitted
        </p>
        <h2 className="mt-2 font-heading text-3xl text-primary">
          {receipt.applicationNo}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {supervisorFormCopy.successNote}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            variant="gold"
            disabled={pdfBusy}
            onClick={() => {
              setPdfBusy(true);
              setPdfNotice(null);
              void downloadSupervisorApplications([receipt])
                .catch(() => setPdfNotice(applicationReviewCopy.downloadFailed))
                .finally(() => setPdfBusy(false));
            }}
          >
            {pdfBusy
              ? applicationReviewCopy.downloadingPdf
              : applicationReviewCopy.downloadPdf}
          </Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back to home
          </Link>
        </div>
        {pdfNotice ? (
          <p role="status" className="mt-3 text-sm text-secondary">
            {pdfNotice}
          </p>
        ) : null}
      </div>
      <SupervisorApplicationSheet receipt={receipt} />
    </div>
  );
}
