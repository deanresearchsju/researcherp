"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, type FieldPath, type UseFormRegister } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { DeskModal, FormDialog, PageTitle } from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { racCopy, racMemo } from "@/data/rac";
import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import {
  currentOffice,
  decideRac,
  presentRac,
  racStanding,
  sameId,
  saveRacProposal,
  scholarsStillGuidedBy,
  subscribeOffice,
  type RacNominee,
  type RacProposal,
} from "@/lib/office";
import { scholarSignInId } from "@/lib/register";
import { usePortalSession } from "@/lib/use-preview-session";

const nomineeSchema = z.object({
  name: z.string().trim().min(2, "Enter the name."),
  designation: z.string().trim().min(2, "Enter the designation."),
  department: z.string().trim().min(2, "Enter the department."),
  institution: z.string().trim().min(2, "Enter the institution."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit phone number."),
  specialization: z.string().trim().min(2, "Enter the specialisation."),
});

const proposalSchema = z.object({
  internal1: nomineeSchema,
  internal2: nomineeSchema,
  external1: nomineeSchema,
  external2: nomineeSchema,
  external3: nomineeSchema,
  reason: z.string().trim(),
});

type ProposalValues = z.infer<typeof proposalSchema>;
type Slot = Exclude<keyof ProposalValues, "reason">;

const slots: readonly [Slot, string, RacNominee["key"], RacNominee["side"]][] = [
  ["internal1", racCopy.internalLabel(1), "internal-1", "internal"],
  ["internal2", racCopy.internalLabel(2), "internal-2", "internal"],
  ["external1", racCopy.externalLabel(1), "external-1", "external"],
  ["external2", racCopy.externalLabel(2), "external-2", "external"],
  ["external3", racCopy.externalLabel(3), "external-3", "external"],
];

function blankNominee(institution: string) {
  return {
    name: "",
    designation: "",
    department: "",
    institution,
    email: "",
    phone: "",
    specialization: "",
  };
}

function blankValues(): ProposalValues {
  return {
    internal1: blankNominee(university.name),
    internal2: blankNominee(university.name),
    external1: blankNominee(""),
    external2: blankNominee(""),
    external3: blankNominee(""),
    reason: "",
  };
}

function valuesFrom(proposal: RacProposal): ProposalValues {
  const values = blankValues();
  for (const [slot, , key] of slots) {
    const nominee = proposal.nominees.find((item) => item.key === key);
    if (nominee) {
      values[slot] = {
        name: nominee.name,
        designation: nominee.designation,
        department: nominee.department,
        institution: nominee.institution,
        email: nominee.email,
        phone: nominee.phone,
        specialization: nominee.specialization,
      };
    }
  }
  values.reason = proposal.reason;
  return values;
}

type Target = {
  identifier: string;
  name: string;
  kind: RacProposal["kind"];
  editing: boolean;
};

function MemberCard({
  role,
  name,
  detail,
}: {
  role: string;
  name: string;
  detail: string;
}) {
  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-secondary uppercase">
        {role}
      </p>
      <p className="mt-1 font-semibold text-primary">{name}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </li>
  );
}

function PresentMembers({
  proposals,
  scholarIdentifier,
}: {
  proposals: RacProposal[];
  scholarIdentifier: string;
}) {
  const present = presentRac(proposals, scholarIdentifier);
  if (!present) {
    return <p className="text-sm text-muted-foreground">No RAC has been approved yet.</p>;
  }
  return (
    <div>
      <ul className="grid gap-3 sm:grid-cols-3">
        <MemberCard
          role="Guide / Supervisor"
          name={present.guide}
          detail="Present supervisor"
        />
        <MemberCard
          role="Internal member"
          name={present.internal.name}
          detail={`${present.internal.designation}, ${present.internal.department}`}
        />
        <MemberCard
          role="External member"
          name={present.external.name}
          detail={`${present.external.designation}, ${present.external.institution}`}
        />
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Constituted on {formatIsoDate(present.approvedOn)}
        {present.selectedBy ? ` · selected by ${present.selectedBy}` : ""}
      </p>
    </div>
  );
}

function NominationMemo({
  proposal,
  onClose,
}: {
  proposal: RacProposal;
  onClose: () => void;
}) {
  const external = proposal.nominees.filter((item) => item.side === "external");
  const date = formatIsoDate((proposal.createdAt || "").slice(0, 10));
  return (
    <DeskModal title={racMemo.title} onClose={onClose}>
      <div className="print-root space-y-4 bg-white p-6 text-sm leading-6 text-foreground">
        <h2 className="text-center text-base font-bold">{racMemo.title}</h2>
        <p>Date: {date}</p>
        <div>
          <p>To</p>
          {racMemo.addressee.map((line) => (
            <p key={line} className="pl-8">
              {line}
            </p>
          ))}
        </div>
        <p>{racMemo.salutation}</p>
        <p>{racMemo.opening}</p>
        <ul className="list-disc space-y-1 pl-8">
          {external.map((item, index) => (
            <li key={item.key}>
              Candidate {index + 1}: {item.name}, {item.designation}, {item.department},{" "}
              {item.institution}
              {proposal.status === "Approved" && proposal.selectedExternal === item.key
                ? " — selected by the Dean"
                : ""}
            </li>
          ))}
        </ul>
        <p>{racMemo.closing}</p>
        <p>
          Scholar: {proposal.scholarName}
          <br />
          Guide: {proposal.supervisorName}
        </p>
        {proposal.kind === "reconstitution" && proposal.reason ? (
          <p>Reason for reconstitution: {proposal.reason}</p>
        ) : null}
        <div className="flex justify-end gap-2 print:hidden">
          <Button type="button" variant="gold" size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
    </DeskModal>
  );
}

function NomineeFields({
  slot,
  label,
  register,
  errors,
}: {
  slot: Slot;
  label: string;
  register: UseFormRegister<ProposalValues>;
  errors: Partial<Record<keyof RacNominee, { message?: string }>> | undefined;
}) {
  const field = (name: keyof RacNominee) =>
    `${slot}.${name}` as FieldPath<ProposalValues>;
  return (
    <fieldset className="rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-primary">{label}</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["name", "Name"],
            ["designation", "Designation"],
            ["department", "Department"],
            ["institution", "Institution"],
            ["email", "Email"],
            ["phone", "Phone"],
            ["specialization", "Specialisation"],
          ] as const
        ).map(([name, title]) => (
          <FormField
            key={name}
            label={title}
            htmlFor={`${slot}-${name}`}
            error={errors?.[name]?.message}
          >
            <Input id={`${slot}-${name}`} {...register(field(name))} />
          </FormField>
        ))}
      </div>
    </fieldset>
  );
}

export function RacScreen({ mode }: { mode: "scholar" | "supervisor" | "admin" }) {
  const session = usePortalSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [agenda, setAgenda] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<
    Record<string, { internal: string; external: string }>
  >({});
  const [target, setTarget] = useState<Target | null>(null);
  const [memo, setMemo] = useState<RacProposal | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const form = useForm<ProposalValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: blankValues(),
  });

  if (!office) return <p className="text-sm text-muted-foreground">Loading RAC…</p>;

  const signed =
    session &&
    ((mode === "scholar" && session.role === "scholar") ||
      (mode === "supervisor" && session.role === "supervisor") ||
      mode === "admin");
  const canSelect = session?.role === "dean" || session?.role === "admin";
  const mine =
    session && mode === "supervisor"
      ? [
          ...office.allocations
            .filter((item) => sameId(item.supervisorIdentifier, session.identifier))
            .map((item) => ({
              identifier: item.scholarIdentifier,
              name: item.scholarName,
            })),
          ...scholarsStillGuidedBy(
            session.name,
            session.identifier,
            office.allocations,
          ).map((scholar) => ({
            identifier: scholarSignInId(scholar),
            name: scholar.name,
          })),
        ]
      : [];

  function startNomination(scholar: { identifier: string; name: string }) {
    if (!office) return;
    const standing = racStanding(office.proposals, scholar.identifier);
    if (standing.pending) {
      form.reset(valuesFrom(standing.pending));
      setTarget({
        ...scholar,
        kind: standing.pending.kind,
        editing: true,
      });
    } else if (standing.canRequest) {
      form.reset(blankValues());
      setTarget({ ...scholar, kind: standing.canRequest, editing: false });
    } else {
      setNotice(standing.blocked);
      return;
    }
    setNotice(null);
  }

  async function onSubmit(values: ProposalValues) {
    if (!target || !session) return;
    if (target.kind === "reconstitution" && values.reason.trim().length < 10) {
      form.setError("reason", { message: "Give the reason for changing the RAC." });
      return;
    }
    const nominees: RacNominee[] = slots.map(([slot, , key, side]) => ({
      key,
      side,
      ...values[slot],
    }));
    const saved = await saveRacProposal({
      kind: target.kind,
      scholarIdentifier: target.identifier,
      scholarName: target.name,
      supervisorIdentifier: session.identifier,
      supervisorName: session.name.trim() || session.identifier,
      nominees,
      reason: target.kind === "reconstitution" ? values.reason.trim() : "",
    });
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setNotice(
      "edited" in saved && saved.edited
        ? `Nomination for ${target.name} updated. It is still waiting for the Dean.`
        : `Nomination for ${target.name} sent to the Dean.`,
    );
    setTarget(null);
    form.reset(blankValues());
  }

  async function decide(proposal: RacProposal, status: "Approved" | "Returned") {
    const picked = choice[proposal.id] ?? { internal: "", external: "" };
    const note = (remarks[proposal.id] ?? "").trim();
    const minute = (minutes[proposal.id] ?? "").trim();
    if (status === "Approved" && (!picked.internal || !picked.external)) {
      setNotice("Select one internal member and one external panel member.");
      return;
    }
    if (status === "Returned" && note.length < 2) {
      setNotice("Enter the remarks before returning a nomination.");
      return;
    }
    if (status === "Approved" && minute.length < 2) {
      setNotice("Enter the minutes before approving.");
      return;
    }
    const saved = await decideRac(proposal, {
      status,
      selectedInternal: status === "Approved" ? picked.internal : "",
      selectedExternal: status === "Approved" ? picked.external : "",
      remarks: note,
      agenda: (agenda[proposal.id] ?? "").trim(),
      attendance: (attendance[proposal.id] ?? "").trim(),
      minutes: minute,
    });
    setNotice(saved.ok ? `RAC marked ${status}.` : saved.message);
    if (saved.ok) setReviewing(null);
  }

  const filtered = office.proposals.filter(
    (proposal) =>
      filterMatches(kindFilter, proposal.kind) &&
      filterMatches(statusFilter, proposal.status) &&
      textMatches(query, [
        proposal.scholarName,
        proposal.supervisorName,
        proposal.kind,
        proposal.status,
      ]),
  );

  return (
    <div>
      <PageTitle
        kicker={racCopy.kicker}
        title={
          mode === "admin"
            ? racCopy.officeTitle
            : mode === "supervisor"
              ? racCopy.supervisorTitle
              : racCopy.scholarTitle
        }
      />
      {office.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{office.detail}</p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}

      {mode !== "admin" && !signed ? (
        <p className="mt-6 text-sm">
          <Link
            href={`/login/${mode}`}
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </Link>{" "}
          to see the RAC.
        </p>
      ) : null}

      {mode === "scholar" && session?.role === "scholar" ? (
        <div className="mt-6">
          <PresentMembers
            proposals={office.proposals}
            scholarIdentifier={session.identifier}
          />
        </div>
      ) : null}

      {mode === "supervisor" && session?.role === "supervisor" ? (
        <div className="mt-6 space-y-6">
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">{racCopy.noScholars}</p>
          ) : (
            mine.map((scholar) => {
              const standing = racStanding(office.proposals, scholar.identifier);
              const returned = office.proposals.find(
                (item) =>
                  item.status === "Returned" &&
                  sameId(item.scholarIdentifier, scholar.identifier) &&
                  !standing.pending &&
                  (!standing.approved || item.createdAt > standing.approved.createdAt),
              );
              return (
                <section
                  key={scholar.identifier}
                  className="rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-primary">{scholar.name}</h2>
                    <Badge
                      variant={
                        standing.approved
                          ? "gold"
                          : standing.pending
                            ? "purple"
                            : "maroon"
                      }
                    >
                      {standing.pending
                        ? racCopy.waiting
                        : standing.approved
                          ? racCopy.constituted
                          : racCopy.notConstituted}
                    </Badge>
                  </div>
                  {standing.approved ? (
                    <div className="mt-3">
                      <PresentMembers
                        proposals={office.proposals}
                        scholarIdentifier={scholar.identifier}
                      />
                    </div>
                  ) : null}
                  {returned ? (
                    <p className="mt-3 text-sm text-secondary">
                      The last nomination was returned
                      {returned.remarks ? `: ${returned.remarks}` : "."} Correct it and
                      submit again.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {standing.pending ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startNomination(scholar)}
                        >
                          {racCopy.edit}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setMemo(standing.pending)}
                        >
                          {racCopy.printMemo}
                        </Button>
                      </>
                    ) : standing.canRequest ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="gold"
                        onClick={() => startNomination(scholar)}
                      >
                        {standing.canRequest === "constitution"
                          ? racCopy.initiate
                          : racCopy.requestChange}
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">{standing.blocked}</p>
                    )}
                  </div>
                </section>
              );
            })
          )}

          {target ? (
            <FormDialog
              title={`${target.kind === "constitution" ? "Constitute the RAC" : "Change the RAC"} · ${target.name}`}
              onClose={() => {
                setTarget(null);
                form.reset(blankValues());
              }}
              onSubmit={form.handleSubmit(onSubmit)}
              busy={form.formState.isSubmitting}
              submitLabel={target.editing ? "Save changes" : "Send to the Dean"}
              size="lg"
            >
              {notice ? (
                <p role="alert" className="text-sm text-secondary">
                  {notice}
                </p>
              ) : null}
              {target.kind === "reconstitution" ? (
                <FormField
                  label="Reason for the change"
                  htmlFor="rac-reason"
                  required
                  error={form.formState.errors.reason?.message}
                >
                  <Textarea id="rac-reason" {...form.register("reason")} />
                </FormField>
              ) : null}
              {slots.map(([slot, label]) => (
                <NomineeFields
                  key={slot}
                  slot={slot}
                  label={label}
                  register={form.register}
                  errors={form.formState.errors[slot]}
                />
              ))}
            </FormDialog>
          ) : null}
        </div>
      ) : null}

      {mode === "admin" ? (
        <div className="mt-6 space-y-4">
          {!canSelect ? (
            <p className="text-sm text-secondary">{racCopy.deanOnly}</p>
          ) : null}
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[
              {
                id: "kind",
                label: "Kind",
                value: kindFilter,
                options: [
                  { value: "constitution", label: "Constitution" },
                  { value: "reconstitution", label: "Reconstitution" },
                ],
                onChange: setKindFilter,
              },
              {
                id: "status",
                label: "Status",
                value: statusFilter,
                options: ["Submitted", "Approved", "Returned"].map((item) => ({
                  value: item,
                  label: item,
                })),
                onChange: setStatusFilter,
              },
            ]}
            shown={filtered.length}
            total={office.proposals.length}
            filename="rac-nominations.csv"
            headers={["scholar", "supervisor", "kind", "status", "selected by"]}
            rows={filtered.map((proposal) => [
              proposal.scholarName,
              proposal.supervisorName,
              proposal.kind,
              proposal.status,
              proposal.decidedBy,
            ])}
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No RAC nominations yet.</p>
          ) : (
            filtered.map((proposal) => {
              const open = proposal.status === "Submitted" && canSelect;
              return (
                <article
                  key={proposal.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-primary">
                        {proposal.scholarName} · {proposal.kind}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Guide {proposal.supervisorName} ·{" "}
                        {formatIsoDate(proposal.createdAt.slice(0, 10))}
                        {proposal.decidedBy
                          ? ` · decided by ${proposal.decidedBy}${proposal.decidedOn ? ` on ${formatIsoDate(proposal.decidedOn)}` : ""}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-readonly-allow
                        onClick={() => setMemo(proposal)}
                      >
                        {racCopy.printMemo}
                      </Button>
                      <Badge
                        variant={
                          proposal.status === "Approved"
                            ? "gold"
                            : proposal.status === "Returned"
                              ? "maroon"
                              : "purple"
                        }
                      >
                        {proposal.status}
                      </Badge>
                    </div>
                  </div>
                  {proposal.reason ? (
                    <p className="mt-3 text-sm">
                      <span className="font-semibold text-primary">Reason: </span>
                      {proposal.reason}
                    </p>
                  ) : null}
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant={open ? "default" : "outline"}
                      data-readonly-allow
                      onClick={() => {
                        setNotice(null);
                        setReviewing(proposal.id);
                      }}
                    >
                      {open ? "Review and select" : "View nomination"}
                    </Button>
                  </div>
                  {reviewing === proposal.id ? (
                    <DeskModal
                      title={`${proposal.scholarName} · ${proposal.kind}`}
                      onClose={() => setReviewing(null)}
                    >
                      {notice ? (
                        <p role="alert" className="text-sm text-secondary">
                          {notice}
                        </p>
                      ) : null}
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                          <thead className="bg-muted text-primary">
                            <tr>
                              <th className="px-2 py-2">Select</th>
                              <th className="px-2 py-2">Side</th>
                              <th className="px-2 py-2">Name</th>
                              <th className="px-2 py-2">Designation</th>
                              <th className="px-2 py-2">Department</th>
                              <th className="px-2 py-2">Institution</th>
                              <th className="px-2 py-2">Contact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {proposal.nominees.map((nominee) => {
                              const picked = choice[proposal.id] ?? {
                                internal: proposal.selectedInternal,
                                external: proposal.selectedExternal,
                              };
                              const selected =
                                nominee.side === "internal"
                                  ? picked.internal === nominee.key
                                  : picked.external === nominee.key;
                              return (
                                <tr key={nominee.key} className="border-t border-border">
                                  <td className="px-2 py-2">
                                    <input
                                      type="radio"
                                      name={`${proposal.id}-${nominee.side}`}
                                      checked={selected}
                                      disabled={!open}
                                      aria-label={`Select ${nominee.name}`}
                                      onChange={() =>
                                        setChoice((current) => ({
                                          ...current,
                                          [proposal.id]: {
                                            internal:
                                              nominee.side === "internal"
                                                ? nominee.key
                                                : (current[proposal.id]?.internal ??
                                                  proposal.selectedInternal),
                                            external:
                                              nominee.side === "external"
                                                ? nominee.key
                                                : (current[proposal.id]?.external ??
                                                  proposal.selectedExternal),
                                          },
                                        }))
                                      }
                                    />
                                  </td>
                                  <td className="px-2 py-2 capitalize">{nominee.side}</td>
                                  <td className="px-2 py-2">{nominee.name}</td>
                                  <td className="px-2 py-2">{nominee.designation}</td>
                                  <td className="px-2 py-2">{nominee.department}</td>
                                  <td className="px-2 py-2">{nominee.institution}</td>
                                  <td className="px-2 py-2">
                                    {nominee.email}
                                    <br />
                                    {nominee.phone}
                                    <br />
                                    {nominee.specialization}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {proposal.remarks ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          {proposal.remarks}
                        </p>
                      ) : null}
                      {proposal.minutes ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {proposal.minutes}
                        </p>
                      ) : null}
                      {open ? (
                        <div className="mt-4 space-y-2">
                          <Textarea
                            aria-label="Agenda"
                            placeholder="Agenda"
                            value={agenda[proposal.id] ?? ""}
                            onChange={(event) =>
                              setAgenda((current) => ({
                                ...current,
                                [proposal.id]: event.target.value,
                              }))
                            }
                          />
                          <Textarea
                            aria-label="Attendance"
                            placeholder="Attendance"
                            value={attendance[proposal.id] ?? ""}
                            onChange={(event) =>
                              setAttendance((current) => ({
                                ...current,
                                [proposal.id]: event.target.value,
                              }))
                            }
                          />
                          <Textarea
                            aria-label="Minutes"
                            placeholder="Minutes"
                            value={minutes[proposal.id] ?? ""}
                            onChange={(event) =>
                              setMinutes((current) => ({
                                ...current,
                                [proposal.id]: event.target.value,
                              }))
                            }
                          />
                          <Textarea
                            aria-label="Remarks"
                            placeholder="Remarks"
                            value={remarks[proposal.id] ?? ""}
                            onChange={(event) =>
                              setRemarks((current) => ({
                                ...current,
                                [proposal.id]: event.target.value,
                              }))
                            }
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="gold"
                              size="sm"
                              onClick={() => void decide(proposal, "Approved")}
                            >
                              Approve selected members
                            </Button>
                            <Button
                              type="button"
                              variant="maroon"
                              size="sm"
                              onClick={() => void decide(proposal, "Returned")}
                            >
                              Return to supervisor
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </DeskModal>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      ) : null}

      {memo ? <NominationMemo proposal={memo} onClose={() => setMemo(null)} /> : null}
    </div>
  );
}
