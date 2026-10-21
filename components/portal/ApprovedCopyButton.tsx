"use client";

import { BadgeCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadApprovedCopy, type ApprovalStamp } from "@/lib/approved-copy";

/** Downloads the approved document with the approval stamp and approval record page. */
export function ApprovedCopyButton({
  fileName,
  data,
  load,
  stamp,
  onError,
  label = "Approved copy",
}: {
  fileName: string | null | undefined;
  data?: string | null;
  load?: () => Promise<string | null>;
  stamp: ApprovalStamp;
  onError?: (message: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="gold"
      disabled={busy}
      data-readonly-allow
      onClick={() => {
        void (async () => {
          setBusy(true);
          try {
            const file = data ?? (load ? await load().catch(() => null) : null);
            await downloadApprovedCopy(file, fileName, stamp);
          } catch {
            onError?.("The approved copy could not be prepared.");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <BadgeCheck className="size-4" aria-hidden="true" />
      {busy ? "Preparing…" : label}
    </Button>
  );
}
