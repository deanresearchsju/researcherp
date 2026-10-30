"use client";

import { useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import { DeskPage, DeskSection, GateBanner } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { researchRegister } from "@/data/research-register";
import { inputRules, typed } from "@/lib/input-rules";
import {
  bioWordLimit,
  currentProfiles,
  currentQuotas,
  saveOwnSupervisorDetails,
  sameGuide,
  subscribeRegister,
  supervisorBySignIn,
  wordCount,
} from "@/lib/register";
import { usePortalSession } from "@/lib/use-preview-session";

const editable = ["phone", "campus", "researchArea", "vidwan", "bio"] as const;

/**
 * A supervisor's own details. What the research office or the supervisor has already entered
 * cannot be changed here; the supervisor fills in what is empty. The name, designation,
 * department and e-mail are the University's record. If anything entered is incorrect, the
 * research office corrects it (Supervisor register, Supervisor profiles). What appears on the
 * public Supervisors page is decided by the research office.
 */
export function SupervisorOwnDetails() {
  const ready = useClientReady();
  const session = usePortalSession();
  const profiles = useSyncExternalStore(
    subscribeRegister,
    currentProfiles,
    currentProfiles,
  );
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (!ready || !session)
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  const supervisor = supervisorBySignIn(session.identifier);
  const approved = quotas.find((item) => sameGuide(item.name, session.name));
  const known =
    supervisor ??
    (approved
      ? {
          name: approved.name,
          designation: approved.designation,
          department: approved.department,
          phone: "",
          campus: "",
          researchArea: "",
          email: session.identifier,
        }
      : null);
  const key = (
    supervisor?.email ||
    supervisor?.supervisorId ||
    supervisor?.name ||
    session.identifier
  )
    .trim()
    .toLowerCase();
  const profile = profiles.find((item) => item.key === key);
  const campuses = [
    ...new Set(
      researchRegister.supervisors.map((item) => item.campus.trim()).filter(Boolean),
    ),
  ].sort();

  if (!known) {
    return (
      <DeskPage kicker="Supervisors" title="My details">
        <GateBanner>
          Your details are not on the register yet. Write to the research office.
        </GateBanner>
      </DeskPage>
    );
  }

  // What is on record now; a filled field is shown and kept, an empty one is typed in.
  const stored: Record<(typeof editable)[number], string> = {
    phone: known.phone,
    campus: known.campus,
    researchArea: profile?.researchArea || known.researchArea,
    vidwan: profile?.vidwan ?? "",
    bio: profile?.bio ?? "",
  };
  const locked = (name: (typeof editable)[number]) => stored[name].trim() !== "";
  const anyEmpty = editable.some((name) => !locked(name));
  const values = { ...stored, ...(draft ?? {}) };
  const set = (name: string, value: string) => setDraft({ ...(draft ?? {}), [name]: value });
  const words = wordCount(values.bio);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setProblem(null);
    const saved = await saveOwnSupervisorDetails({
      phone: values.phone,
      campus: values.campus,
      researchArea: values.researchArea,
      vidwan: values.vidwan,
      bio: values.bio,
    });
    setBusy(false);
    if (!saved.ok) {
      setProblem("message" in saved ? saved.message : "Your details could not be saved.");
      return;
    }
    setDraft(null);
    setNotice("Your details are saved.");
  }

  return (
    <DeskPage kicker="Supervisors" title="My details">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <GateBanner>
        {anyEmpty
          ? "Fill in the details that are empty. What is already entered cannot be changed here: if anything is incorrect, write to the research office or raise a question under Helpdesk, and the staff will correct it. Your name, designation and department are the University's record."
          : "Your details are complete. What is entered cannot be changed here: if anything is incorrect, write to the research office or raise a question under Helpdesk, and the staff will correct it."}
      </GateBanner>
      <form onSubmit={save} noValidate>
        <DeskSection title="About you">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="own-name">
              <Input id="own-name" readOnly value={known.name} />
            </FormField>
            <FormField label="Designation" htmlFor="own-designation">
              <Input id="own-designation" readOnly value={known.designation} />
            </FormField>
            <FormField label="Department" htmlFor="own-department">
              <Input id="own-department" readOnly value={known.department} />
            </FormField>
            <FormField label="E-mail" htmlFor="own-email">
              <Input id="own-email" readOnly value={known.email || session.identifier} />
            </FormField>
            <FormField label="Phone" htmlFor="own-phone">
              <Input
                id="own-phone"
                readOnly={locked("phone")}
                {...typed(inputRules.phone, values.phone, (next) => set("phone", next))}
              />
            </FormField>
            <FormField label="Campus" htmlFor="own-campus">
              <NativeSelect
                id="own-campus"
                disabled={locked("campus")}
                value={values.campus}
                onChange={(event) => set("campus", event.target.value)}
              >
                <option value="">Select</option>
                {[...new Set([...campuses, values.campus].filter(Boolean))].map(
                  (campus) => (
                    <option key={campus} value={campus}>
                      {campus}
                    </option>
                  ),
                )}
              </NativeSelect>
            </FormField>
            <FormField
              label="Area of research"
              htmlFor="own-area"
              className="sm:col-span-2"
              hint={
                locked("researchArea")
                  ? undefined
                  : "Short topics separated by commas, for example: Computer networks, Cloud computing."
              }
            >
              <Textarea
                id="own-area"
                rows={2}
                readOnly={locked("researchArea")}
                value={values.researchArea}
                onChange={(event) => set("researchArea", event.target.value)}
              />
            </FormField>
            <FormField
              label="Vidwan ID"
              htmlFor="own-vidwan"
              hint={
                locked("vidwan")
                  ? undefined
                  : "Your Vidwan ID, or the full address of your Vidwan profile."
              }
            >
              <Input
                id="own-vidwan"
                readOnly={locked("vidwan")}
                {...typed(inputRules.doi, values.vidwan, (next) => set("vidwan", next))}
              />
            </FormField>
            <FormField
              label={`Biography (up to ${bioWordLimit} words)`}
              htmlFor="own-bio"
              className="sm:col-span-2"
              hint={`${words} of ${bioWordLimit} words`}
            >
              <Textarea
                id="own-bio"
                rows={6}
                readOnly={locked("bio")}
                value={values.bio}
                onChange={(event) => set("bio", event.target.value)}
              />
            </FormField>
          </div>
        </DeskSection>
        {problem ? (
          <p role="alert" className="mt-3 text-sm text-secondary">
            {problem}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {anyEmpty ? (
            <Button type="submit" variant="gold" disabled={busy || words > bioWordLimit}>
              {busy ? "Saving…" : "Save the details I filled in"}
            </Button>
          ) : null}
          <span className="text-sm text-muted-foreground">
            {profile?.published
              ? "Your profile is shown on the public Supervisors page."
              : "The research office decides when your profile is shown on the public Supervisors page."}
          </span>
        </div>
      </form>
    </DeskPage>
  );
}
