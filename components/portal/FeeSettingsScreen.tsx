"use client";

import { useState } from "react";

import { DeskPage } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveFeeSettings, useFees, type FeeSettings } from "@/lib/fee-settings";

const groups: readonly {
  title: string;
  hint: string;
  fields: readonly { key: keyof FeeSettings; label: string; hint: string }[];
}[] = [
  {
    title: "Application",
    hint: "Paid by every candidate with the Ph.D. application.",
    fields: [
      {
        key: "application",
        label: "Application fee",
        hint: "Shown on the public site, the application and the Accounts screens.",
      },
    ],
  },
  {
    title: "Annual research fee",
    hint: "Per year, in up to three instalments.",
    fields: [
      {
        key: "fullTime",
        label: "Full time",
        hint: "Scholar fee pages, provisional letter, public site.",
      },
      {
        key: "partTime",
        label: "Part time (internal and external)",
        hint: "Scholar fee pages, provisional letter, public site.",
      },
    ],
  },
  {
    title: "Submission fees",
    hint: "Paid before the upload opens; 0 means no fee.",
    fields: [
      {
        key: "synopsis",
        label: "Synopsis submission fee",
        hint: "Paid before the synopsis is uploaded.",
      },
      {
        key: "thesis",
        label: "Ph.D. thesis submission fee",
        hint: "Paid before the thesis is uploaded.",
      },
    ],
  },
];

/**
 * Every fee the University charges, in one place. The administrator changes a fee here and it
 * shows in every page that mentions it: the public site, the application, the provisional
 * letter, the scholar's fee pages and the Accounts screens.
 */
export function FeeSettingsScreen() {
  const fees = useFees();
  const [draft, setDraft] = useState<Partial<Record<keyof FeeSettings, string>>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const value = (key: keyof FeeSettings) => draft[key] ?? String(fees[key]);
  const changed = Object.keys(draft).length > 0;

  async function save() {
    setBusy(true);
    setNotice(null);
    const next = { ...fees };
    for (const [key, text] of Object.entries(draft)) {
      next[key as keyof FeeSettings] = Number(text) || 0;
    }
    const saved = await saveFeeSettings(next);
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setDraft({});
    setNotice("Fees saved. They now show on every page that mentions a fee.");
  }

  return (
    <DeskPage kicker="Administration" title="Fee settings">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Fix the University&apos;s fees here and change them whenever they are revised. A
        change appears automatically on the public site, the application, the provisional
        letter, the scholars&apos; fee pages and the Accounts screens. Fees already paid
        are not changed.
      </p>
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <div className="grid gap-5">
        {groups.map((group) => (
          <section
            key={group.title}
            className="rounded-xl border border-border bg-card p-5 shadow-card"
          >
            <h2 className="font-heading text-xl text-primary">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.hint}</p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {group.fields.map((field) => (
                <label key={field.key} className="grid gap-1 text-sm">
                  <span className="font-semibold text-primary">{field.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">₹</span>
                    <Input
                      inputMode="numeric"
                      className="w-48"
                      value={value(field.key)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [field.key]: event.target.value.replace(/\D/g, "").slice(0, 7),
                        }))
                      }
                      aria-label={field.label}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{field.hint}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="gold"
          disabled={busy || !changed}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save fees"}
        </Button>
        {changed ? (
          <Button type="button" variant="outline" onClick={() => setDraft({})}>
            Discard changes
          </Button>
        ) : null}
      </div>
    </DeskPage>
  );
}
