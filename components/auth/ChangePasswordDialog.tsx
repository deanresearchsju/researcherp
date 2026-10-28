"use client";

import { Check, Eye, EyeOff, X } from "lucide-react";
import { useState } from "react";

import { DeskModal, FormDialog } from "@/components/portal/Desk";
import { Input } from "@/components/ui/input";
import { passwordChecks, passwordProblem } from "@/lib/password-rules";
import { usePreviewSession } from "@/lib/use-preview-session";

/** Every signed-in user changes their own password here: current password, then a strong new one. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const session = usePreviewSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const problem = passwordProblem(
    next,
    session ? [session.identifier, session.name] : [],
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!current) return setMessage("Enter your current password.");
    if (problem) return setMessage(problem);
    if (next !== again) return setMessage("The two new passwords do not match.");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, password: next }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (payload.ok) setDone(true);
      else setMessage(payload.message ?? "The new password could not be saved.");
    } catch {
      setMessage("The new password could not be saved. Check the connection.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <DeskModal title="Change password" size="md" onClose={onClose}>
        <p role="status" className="text-sm font-medium text-primary">
          Your password is changed. Use it the next time you sign in.
        </p>
      </DeskModal>
    );
  }

  return (
    <FormDialog
      title="Change password"
      size="md"
      onClose={onClose}
      busy={busy}
      submitLabel="Change password"
      onSubmit={submit}
    >
      <div className="space-y-3">
        <label className="block space-y-1 text-sm font-medium">
          Current password
          <Input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          New password
          <Input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </label>
        <ul className="grid gap-1 text-xs sm:grid-cols-2" aria-label="Password strength">
          {passwordChecks(next).map((item) => (
            <li
              key={item.label}
              className={item.ok ? "text-primary" : "text-muted-foreground"}
            >
              {item.ok ? (
                <Check className="mr-1 inline size-3.5" aria-hidden="true" />
              ) : (
                <X className="mr-1 inline size-3.5" aria-hidden="true" />
              )}
              {item.label}
            </li>
          ))}
        </ul>
        <label className="block space-y-1 text-sm font-medium">
          Repeat the new password
          <Input
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={again}
            onChange={(event) => setAgain(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary"
          onClick={() => setShow((value) => !value)}
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {show ? "Hide" : "Show"} passwords
        </button>
        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}
