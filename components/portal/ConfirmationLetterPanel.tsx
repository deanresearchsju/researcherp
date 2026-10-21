"use client";

import { Download, FileCheck2, Mail } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { FilePreview } from "@/components/portal/FilePreview";
import { LettersScreen, useLetterSigner } from "@/components/portal/LettersScreen";
import { Button } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import {
  currentDoctoral,
  latestCommittee,
  letterName,
  lettersOf,
  subscribeDoctoral,
  type DoctoralState,
  type IssuedLetter,
} from "@/lib/doctoral";
import { downloadLetter, letterDataUrl, letterFileName } from "@/lib/letter-pdf";
import { scholarBySignIn, supervisorForGuide } from "@/lib/register";

/** Office tab on the Ph.D. confirmation page. */
export function OfficeConfirmationLetters() {
  return <LettersScreen only="confirmation" />;
}

function LetterRow({ letter }: { letter: IssuedLetter }) {
  const signer = useLetterSigner(letter.kind);
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Mail className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-primary">{letterName(letter.kind)}</p>
          <p className="text-xs text-muted-foreground">
            {letter.refNo} · dated {formatIsoDate(letter.issuedOn)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-readonly-allow
          onClick={() => void letterDataUrl(letter, signer).then(setPreview)}
        >
          View
        </Button>
        <Button
          type="button"
          size="sm"
          variant="gold"
          data-readonly-allow
          onClick={() => void downloadLetter(letter, signer)}
        >
          <Download className="size-4" aria-hidden="true" />
          Download
        </Button>
      </div>
      {preview ? (
        <FilePreview
          fileName={letterFileName(letter)}
          data={preview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </li>
  );
}

/** Letters the University issued to this scholar or supervisor. */
export function MyLetters({
  role,
  identifier,
  name = "",
}: {
  role: "scholar" | "supervisor";
  identifier: string;
  name?: string;
}) {
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  if (!doctoral || !identifier) return null;
  const keys = [identifier, name];
  if (role === "scholar") {
    const scholar = scholarBySignIn(identifier);
    if (scholar)
      keys.push(scholar.email, scholar.registrationNumber, scholar.applicationNumber);
  } else {
    const guide = supervisorForGuide(identifier) ?? supervisorForGuide(name);
    if (guide) keys.push(guide.email, guide.supervisorId, guide.name);
  }
  const all = lettersOf(doctoral, role, keys);
  // Only the latest copy of a reissued letter.
  const letters = all.filter(
    (letter) =>
      !all.some(
        (other) =>
          other.kind === letter.kind &&
          other.sourceId === letter.sourceId &&
          other.createdAt > letter.createdAt,
      ),
  );
  if (letters.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold text-primary">Letters from the University</h2>
      </div>
      <ul className="divide-y divide-border">
        {letters.map((letter) => (
          <LetterRow key={letter.id} letter={letter} />
        ))}
      </ul>
    </section>
  );
}

export function ScholarConfirmationLetter({
  doctoral,
  identifier,
}: {
  doctoral: DoctoralState;
  identifier: string;
}) {
  const signer = useLetterSigner("confirmation");
  const report = latestCommittee(doctoral, "second", identifier);
  if (report?.status !== "Approved") return null;
  const letter =
    doctoral.letters
      .filter((item) => item.kind === "confirmation" && item.sourceId === report.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/50 bg-accent/10 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <FileCheck2 className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-primary">
            Confirmation of provisional registration
          </p>
          <p className="text-sm text-muted-foreground">
            {letter
              ? `${letter.refNo} · dated ${formatIsoDate(letter.issuedOn)}`
              : "Your Ph.D. confirmation is approved. The research office will issue the letter."}
          </p>
        </div>
      </div>
      {letter ? (
        <Button
          type="button"
          variant="gold"
          data-readonly-allow
          onClick={() => void downloadLetter(letter, signer)}
        >
          Download letter
        </Button>
      ) : null}
    </div>
  );
}
