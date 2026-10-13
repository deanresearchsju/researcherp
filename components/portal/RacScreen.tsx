"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, type FieldPath, type UseFormRegister } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { university } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import {
  currentOffice,
  decideRac,
  presentRac,
  sameId,
  saveRacProposal,
  subscribeOffice,
  type RacNominee,
  type RacProposal,
} from "@/lib/office";
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
  scholarIdentifier: z.string().min(1, "Select a scholar."),
  kind: z.enum(["constitution", "reconstitution"]),
  internal1: nomineeSchema,
  internal2: nomineeSchema,
  external1: nomineeSchema,
  external2: nomineeSchema,
});

type ProposalValues = z.infer<typeof proposalSchema>;

const slots = [
  ["internal1", "Internal member 1", "internal-1", "internal"],
  ["internal2", "Internal member 2", "internal-2", "internal"],
  ["external1", "External member 1", "external-1", "external"],
  ["external2", "External member 2", "external-2", "external"],
] as const;

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
  );
}

function NomineeFields({
  slot,
  label,
  register,
  errors,
}: {
  slot: "internal1" | "internal2" | "external1" | "external2";
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
  const [choice, setChoice] = useState<
    Record<string, { internal: string; external: string }>
  >({});
  const form = useForm<ProposalValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      scholarIdentifier: "",
      kind: "constitution",
      internal1: blankNominee(university.name),
      internal2: blankNominee(university.name),
      external1: blankNominee(""),
      external2: blankNominee(""),
    },
  });

  if (!office) return <p className="text-sm text-muted-foreground">Loading RAC…</p>;

  const signed =
    session &&
    ((mode === "scholar" && session.role === "scholar") ||
      (mode === "supervisor" && session.role === "supervisor") ||
      mode === "admin");
  const allotted =
    session && mode === "supervisor"
      ? office.allocations.filter((item) =>
          sameId(item.supervisorIdentifier, session.identifier),
        )
      : [];

  async function onSubmit(values: ProposalValues) {
    const scholar = allotted.find(
      (item) => item.scholarIdentifier === values.scholarIdentifier,
    );
    if (!scholar || !session) return;
    const nominees = slots.map(([slot, , key, side]) => ({
      key,
      side,
      ...values[slot],
    }));
    const saved = await saveRacProposal({
      kind: values.kind,
      scholarIdentifier: scholar.scholarIdentifier,
      scholarName: scholar.scholarName,
      supervisorIdentifier: session.identifier,
      supervisorName: session.name.trim() || session.identifier,
      nominees,
    });
    setNotice(
      saved.ok
        ? "Nomination submitted for the research office."
        : "That nomination could not be saved.",
    );
    if (saved.ok) {
      form.reset({
        scholarIdentifier: "",
        kind: "constitution",
        internal1: blankNominee(university.name),
        internal2: blankNominee(university.name),
        external1: blankNominee(""),
        external2: blankNominee(""),
      });
    }
  }

  async function decide(proposal: RacProposal, status: "Approved" | "Returned") {
    const picked = choice[proposal.id] ?? { internal: "", external: "" };
    if (status === "Approved" && (!picked.internal || !picked.external)) {
      setNotice("Select one internal member and one external member.");
      return;
    }
    const saved = await decideRac(proposal, {
      status,
      selectedInternal: status === "Approved" ? picked.internal : "",
      selectedExternal: status === "Approved" ? picked.external : "",
    });
    setNotice(saved ? `RAC marked ${status}.` : "That decision could not be saved.");
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Research Advisory Committee
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">
        {mode === "admin"
          ? "RAC decisions"
          : mode === "supervisor"
            ? "RAC proposal"
            : "RAC members"}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {mode === "admin"
          ? "Every nomination is kept here. Choose one internal member and one external member, then approve. Scholars and supervisors see only the present guide and the two approved members."
          : "The present guide, internal member, and external member. Earlier nominees stay with the research office."}
      </p>
      {office.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">
          {office.detail}
        </p>
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
          {allotted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scholar is allotted to you yet. RAC follows allotment.
            </p>
          ) : (
            allotted.map((scholar) => (
              <section key={scholar.id}>
                <h2 className="font-semibold text-primary">{scholar.scholarName}</h2>
                <div className="mt-3">
                  <PresentMembers
                    proposals={office.proposals}
                    scholarIdentifier={scholar.scholarIdentifier}
                  />
                </div>
              </section>
            ))
          )}

          {allotted.length > 0 ? (
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <h2 className="font-heading text-2xl text-primary">Nominate a committee</h2>
              <p className="text-sm text-muted-foreground">
                Name two internal and two external members. The office selects one of
                each. Use reconstitution when the committee has to be formed again.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Scholar"
                  htmlFor="rac-scholar"
                  error={form.formState.errors.scholarIdentifier?.message}
                >
                  <NativeSelect id="rac-scholar" {...form.register("scholarIdentifier")}>
                    <option value="">Select a scholar</option>
                    {allotted.map((scholar) => (
                      <option key={scholar.id} value={scholar.scholarIdentifier}>
                        {scholar.scholarName}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField label="Request" htmlFor="rac-kind">
                  <NativeSelect id="rac-kind" {...form.register("kind")}>
                    <option value="constitution">Constitution</option>
                    <option value="reconstitution">Reconstitution</option>
                  </NativeSelect>
                </FormField>
              </div>
              {slots.map(([slot, label]) => (
                <NomineeFields
                  key={slot}
                  slot={slot}
                  label={label}
                  register={form.register}
                  errors={form.formState.errors[slot]}
                />
              ))}
              <Button type="submit" variant="gold" disabled={form.formState.isSubmitting}>
                Submit nomination
              </Button>
            </form>
          ) : null}

          <section>
            <h2 className="font-semibold text-primary">Your nominations</h2>
            <ul className="mt-3 space-y-2">
              {office.proposals
                .filter(
                  (item) =>
                    session &&
                    sameId(item.supervisorIdentifier, session.identifier) &&
                    item.status !== "Approved",
                )
                .map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-card p-4 text-sm"
                  >
                    <p className="font-semibold text-primary">
                      {item.scholarName} · {item.kind}
                    </p>
                    <p className="text-muted-foreground">{item.status}</p>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      ) : null}

      {mode === "admin" ? (
        <div className="mt-6 space-y-4">
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
            shown={
              office.proposals.filter(
                (proposal) =>
                  (kindFilter === "" || proposal.kind === kindFilter) &&
                  (statusFilter === "" || proposal.status === statusFilter) &&
                  textMatches(query, [
                    proposal.scholarName,
                    proposal.supervisorName,
                    proposal.kind,
                    proposal.status,
                  ]),
              ).length
            }
            total={office.proposals.length}
            filename="rac-nominations.csv"
            headers={["scholar", "supervisor", "kind", "status"]}
            rows={office.proposals
              .filter(
                (proposal) =>
                  (kindFilter === "" || proposal.kind === kindFilter) &&
                  (statusFilter === "" || proposal.status === statusFilter) &&
                  textMatches(query, [
                    proposal.scholarName,
                    proposal.supervisorName,
                    proposal.kind,
                    proposal.status,
                  ]),
              )
              .map((proposal) => [
                proposal.scholarName,
                proposal.supervisorName,
                proposal.kind,
                proposal.status,
              ])}
          />
          {office.proposals.filter(
            (proposal) =>
              (kindFilter === "" || proposal.kind === kindFilter) &&
              (statusFilter === "" || proposal.status === statusFilter) &&
              textMatches(query, [
                proposal.scholarName,
                proposal.supervisorName,
                proposal.kind,
                proposal.status,
              ]),
          ).length === 0 ? (
            <p className="text-sm text-muted-foreground">No RAC nominations yet.</p>
          ) : (
            office.proposals
              .filter(
                (proposal) =>
                  (kindFilter === "" || proposal.kind === kindFilter) &&
                  (statusFilter === "" || proposal.status === statusFilter) &&
                  textMatches(query, [
                    proposal.scholarName,
                    proposal.supervisorName,
                    proposal.kind,
                    proposal.status,
                  ]),
              )
              .map((proposal) => (
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
                    </p>
                  </div>
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
                <div className="mt-4 overflow-x-auto">
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
                {proposal.status === "Submitted" ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      variant="gold"
                      size="sm"
                      onClick={() => void decide(proposal, "Approved")}
                    >
                      Approve selected
                    </Button>
                    <Button
                      type="button"
                      variant="maroon"
                      size="sm"
                      onClick={() => void decide(proposal, "Returned")}
                    >
                      Return
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
