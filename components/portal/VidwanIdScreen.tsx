"use client";

import { ExternalLink } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskPage, ScholarIdentityHeader } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  currentDoctoral,
  saveVidwanId,
  subscribeDoctoral,
  vidwanOf,
  vidwanProblem,
} from "@/lib/doctoral";
import { vidwanLink } from "@/lib/register";
import { usePortalSession } from "@/lib/use-preview-session";

/**
 * The scholar's Vidwan ID: only the number is entered and saved. Once saved, the home page shows
 * it as a link that opens the Vidwan portal.
 */
export function VidwanIdScreen() {
  const ready = useClientReady();
  const session = usePortalSession();
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready || !session || !doctoral) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const saved = vidwanOf(doctoral, session.identifier);
  const editing = draft !== null || !saved;
  const value = draft ?? saved;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    const problem = vidwanProblem(value);
    if (problem) return setMessage(problem);
    setBusy(true);
    const result = await saveVidwanId(session.identifier, value);
    setBusy(false);
    if (!result.ok) return setMessage(result.message);
    setDraft(null);
    setMessage("Saved. Your Vidwan ID now shows on your home page.");
  }

  return (
    <DeskPage kicker="Scholar records" title="Vidwan ID">
      <ScholarIdentityHeader identifier={session.identifier} />
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Enter your Vidwan ID (the number only) and save it. It then appears on your home
        page as a link to your profile on the Vidwan portal.
      </p>
      {message ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {message}
        </p>
      ) : null}
      {editing ? (
        <form
          onSubmit={(event) => void save(event)}
          className="grid max-w-md gap-4 rounded-2xl border border-border bg-card p-5 shadow-card"
        >
          <FormField label="Vidwan ID" htmlFor="vidwan-id" required>
            <Input
              id="vidwan-id"
              value={value}
              inputMode="text"
              maxLength={200}
              onChange={(event) => setDraft(event.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {saved ? (
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="max-w-md rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Your Vidwan ID
          </p>
          <p className="mt-1 text-2xl font-semibold text-primary">{saved}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={vidwanLink(saved)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Open on the Vidwan portal
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setMessage("");
                setDraft(saved);
              }}
            >
              Change
            </Button>
          </div>
        </div>
      )}
    </DeskPage>
  );
}
