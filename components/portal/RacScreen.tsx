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
import {
  chainOf,
  currentApprovalRules,
  mayAct,
  stageApplies,
  subscribeApprovalRules,
} from "@/lib/approval-rules";
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
  decideRacFinal,
  deleteRacEntry,
  enterRacByOffice,
  normaliseNominee,
  nomineeProblem,
  presentRac,
  racExternalMax,
  racMemberProblem,
  racExternalMin,
  racInternalMax,
  racInternalMin,
  racStanding,
  sameId,
  saveRacProposal,
  scholarsStillGuidedBy,
  subscribeOffice,
  type RacNominee,
  type RacProposal,
} from "@/lib/office";
import { researchRegister } from "@/data/research-register";
import { scholarSignInId, supervisorForGuide } from "@/lib/register";
import { usePortalSession } from "@/lib/use-preview-session";
import { useScholarProfiles } from "@/lib/use-scholar-profile";
import { ProfileCell } from "@/components/portal/ProfileCell";

const nomineeSchema = z.object({
  name: z.string().trim().min(2, "Enter the name."),
  designation: z.string().trim().min(2, "Enter the designation."),
  department: z.string().trim(),
  institution: z.string().trim().min(2, "Enter the institution."),
  address: z.string().trim().min(5, "Enter the address."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 8, "Enter the contact number."),
  specialization: z.string().trim().min(2, "Enter the area of research."),
  publications: z.array(z.string()),
});

/** An optional member: left empty it is ignored; once started it needs every detail. */
const looseNominee = z.object({
  name: z.string(),
  designation: z.string(),
  department: z.string(),
  institution: z.string(),
  address: z.string(),
  email: z.string(),
  phone: z.string(),
  specialization: z.string(),
  publications: z.array(z.string()),
});

const optionalSlots = ["internal2", "internal3", "external3"] as const;

/** Has anything been typed for this member (the institution of an internal member is pre-filled)? */
function touched(value: z.infer<typeof looseNominee>) {
  return [
    value.name,
    value.designation,
    value.department,
    value.address,
    value.email,
    value.phone,
    value.specialization,
  ].some((item) => item.trim());
}

const proposalSchema = z
  .object({
    internal1: nomineeSchema,
    internal2: looseNominee,
    internal3: looseNominee,
    external1: nomineeSchema,
    external2: nomineeSchema,
    external3: looseNominee,
    reason: z.string().trim(),
  })
  .superRefine((values, context) => {
    for (const slot of optionalSlots) {
      if (!touched(values[slot])) continue;
      const checked = nomineeSchema.safeParse(values[slot]);
      if (checked.success) continue;
      for (const issue of checked.error.issues) {
        context.addIssue({
          code: "custom",
          message: issue.message,
          path: [slot, ...issue.path],
        });
      }
    }
  });

type ProposalValues = z.infer<typeof proposalSchema>;
type Slot = Exclude<keyof ProposalValues, "reason">;

const slots: readonly [Slot, string, RacNominee["key"], RacNominee["side"]][] = [
  ["internal1", racCopy.internalLabel(1), "internal-1", "internal"],
  ["internal2", `${racCopy.internalLabel(2)} (optional)`, "internal-2", "internal"],
  ["internal3", `${racCopy.internalLabel(3)} (optional)`, "internal-3", "internal"],
  ["external1", racCopy.externalLabel(1), "external-1", "external"],
  ["external2", racCopy.externalLabel(2), "external-2", "external"],
  ["external3", `${racCopy.externalLabel(3)} (optional)`, "external-3", "external"],
];

function blankNominee(institution: string) {
  return {
    name: "",
    designation: "",
    department: "",
    institution,
    address: "",
    email: "",
    phone: "",
    specialization: "",
    publications: [] as string[],
  };
}

function blankValues(): ProposalValues {
  return {
    internal1: blankNominee(university.name),
    internal2: blankNominee(university.name),
    internal3: blankNominee(university.name),
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
        address: nominee.address,
        email: nominee.email,
        phone: nominee.phone,
        specialization: nominee.specialization,
        publications: nominee.publications,
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
              {(proposal.status === "Approved" || proposal.status === "With VC") &&
              proposal.selectedExternal === item.key
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
  errors: unknown;
}) {
  const field = (name: string) => `${slot}.${name}` as FieldPath<ProposalValues>;
  const problems = (errors ?? {}) as Record<string, { message?: string }> & {
    publications?: ({ message?: string } | undefined)[];
  };
  return (
    <fieldset className="rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-primary">{label}</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["name", "Name"],
            ["designation", "Designation"],
            ["department", "Department"],
            ["institution", "Institution name"],
            ["email", "Email"],
            ["phone", "Contact number"],
            ["specialization", "Area of research"],
          ] as const
        ).map(([name, title]) => (
          <FormField
            key={name}
            label={title}
            htmlFor={`${slot}-${name}`}
            required={name !== "department"}
            error={problems[name]?.message}
          >
            <Input id={`${slot}-${name}`} {...register(field(name))} />
          </FormField>
        ))}
        <div className="sm:col-span-2">
          <FormField
            label="Address"
            htmlFor={`${slot}-address`}
            required
            error={problems.address?.message}
          >
            <Input id={`${slot}-address`} {...register(field("address"))} />
          </FormField>
        </div>
      </div>
    </fieldset>
  );
}

/** One member typed in by the research office (the same details, without the form library). */
function NomineeEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: RacNominee;
  onChange: (next: RacNominee) => void;
}) {
  const set = (key: keyof RacNominee, text: string) =>
    onChange({ ...value, [key]: text });
  return (
    <fieldset className="rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-semibold text-primary">{label}</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["name", "Name"],
            ["designation", "Designation"],
            ["department", "Department"],
            ["institution", "Institution name"],
            ["email", "Email"],
            ["phone", "Contact number"],
            ["specialization", "Area of research"],
          ] as const
        ).map(([key, title]) => (
          <label key={key} className="grid gap-1 text-sm font-medium">
            {title}
            <Input
              value={value[key]}
              onChange={(event) => set(key, event.target.value)}
            />
          </label>
        ))}
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Address
          <Input
            value={value.address}
            onChange={(event) => set("address", event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}

const sideLabel = (side: RacNominee["side"], recorded: boolean, key: string) => {
  if (side === "coguide") return "Co-guide (if required)";
  if (side === "internal") return `Internal member ${key.slice(-1)}`;
  return recorded ? "External member" : `External panel candidate ${key.slice(-1)}`;
};

const blankMember = (
  key: RacNominee["key"],
  side: RacNominee["side"],
  institution = "",
): RacNominee => ({
  key,
  side,
  ...blankNominee(institution),
});

/**
 * The research office enters a RAC for a scholar: the supervisor, the one internal member and
 * the external candidates, with the details. It goes to the Dean and the Vice Chancellor like any
 * other nomination; the administrator can instead record a RAC approved earlier.
 */
export function OfficeEntryDialog({
  scholars,
  canRecord,
  initialScholar = "",
  defaultRecorded = false,
  onClose,
  onDone,
}: {
  scholars: {
    identifier: string;
    name: string;
    supervisorIdentifier: string;
    supervisorName: string;
  }[];
  canRecord: boolean;
  /** The scholar already chosen (when the dialog is opened from the Scholar register). */
  initialScholar?: string;
  /** Start with "approved earlier" ticked: the usual case when the RACs of all batches are entered. */
  defaultRecorded?: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [scholar, setScholar] = useState(initialScholar);
  const [recorded, setRecorded] = useState(defaultRecorded && canRecord);
  const [reason, setReason] = useState("");
  const [members, setMembers] = useState<RacNominee[]>([
    blankMember("internal-1", "internal", university.name),
    blankMember("external-1", "external"),
    blankMember("external-2", "external"),
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const internalCount = members.filter((item) => item.side === "internal").length;
  const externalCount = members.filter((item) => item.side === "external").length;
  const coGuide = members.find((item) => item.side === "coguide");
  const shown = recorded
    ? [
        members.find((item) => item.side === "internal"),
        members.find((item) => item.side === "external"),
        coGuide,
      ].filter((item): item is RacNominee => Boolean(item))
    : members;
  const addMember = (side: RacNominee["side"]) =>
    setMembers((current) => {
      const same = current.filter((item) => item.side === side).length;
      return [
        ...current,
        blankMember(
          `${side}-${same + 1}` as RacNominee["key"],
          side,
          side === "internal" ? university.name : "",
        ),
      ];
    });
  const picked = scholars.find((item) => item.identifier === scholar);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!picked) return setError("Choose the scholar.");
    // An extra member left completely empty is ignored.
    const used = shown.filter(
      (member, index) =>
        index < (recorded ? 2 : racInternalMin + racExternalMin) || touched(member),
    );
    for (const member of used) {
      // A RAC approved earlier, and a co-guide, need only the name, designation and institution.
      const problem =
        recorded || member.side === "coguide"
          ? racMemberProblem(member)
          : nomineeProblem(member);
      if (problem) return setError(problem);
    }
    setBusy(true);
    const saved = await enterRacByOffice({
      scholarIdentifier: picked.identifier,
      scholarName: picked.name,
      supervisorIdentifier: picked.supervisorIdentifier,
      supervisorName: picked.supervisorName,
      nominees: used.map(normaliseNominee),
      reason,
      alreadyApproved: recorded,
    });
    setBusy(false);
    if (!saved.ok) return setError(saved.message);
    onDone(
      recorded
        ? `The RAC of ${picked.name} is recorded as approved.`
        : `The RAC details of ${picked.name} are entered. They wait for the Dean, then the Vice Chancellor.`,
    );
  }

  return (
    <FormDialog
      title="Enter RAC details for a scholar"
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel={recorded ? "Record the RAC" : "Send for approval"}
      size="lg"
    >
      <div className="space-y-4">
        <label className="grid gap-1 text-sm font-medium">
          Scholar (with the guide)
          <select
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"
            value={scholar}
            onChange={(event) => setScholar(event.target.value)}
          >
            <option value="">Choose…</option>
            {scholars.map((item) => (
              <option key={item.identifier} value={item.identifier}>
                {item.name} — guide {item.supervisorName}
              </option>
            ))}
          </select>
        </label>
        {canRecord ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={recorded}
              onChange={(event) => setRecorded(event.target.checked)}
            />
            <span>
              This RAC was approved earlier: record it as approved (one internal and one
              external member). Leave unticked to send it through the Dean and the Vice
              Chancellor.
            </span>
          </label>
        ) : null}
        {shown.map((member) => (
          <NomineeEditor
            key={member.key}
            label={sideLabel(member.side, recorded, member.key)}
            value={member}
            onChange={(next) =>
              setMembers((current) =>
                current.map((item) => (item.key === member.key ? next : item)),
              )
            }
          />
        ))}
        <div className="flex flex-wrap gap-2">
          {coGuide ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setMembers((current) => current.filter((item) => item.side !== "coguide"))
              }
            >
              Remove the co-guide
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setMembers((current) => [...current, blankMember("coguide-1", "coguide")])
              }
            >
              Add a co-guide
            </Button>
          )}
        </div>
        {!recorded ? (
          <div className="flex flex-wrap gap-2">
            {internalCount < racInternalMax ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addMember("internal")}
              >
                Add another internal member
              </Button>
            ) : null}
            {externalCount < racExternalMax ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addMember("external")}
              >
                Add another external candidate
              </Button>
            ) : null}
          </div>
        ) : null}
        <label className="grid gap-1 text-sm font-medium">
          Reason (only when the RAC is being changed)
          <Input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-secondary">
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}

export function RacScreen({ mode }: { mode: "scholar" | "supervisor" | "admin" }) {
  const session = usePortalSession();
  const office = useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const rules = useSyncExternalStore(
    subscribeApprovalRules,
    currentApprovalRules,
    () => null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const profile = useScholarProfiles();
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
  const [entering, setEntering] = useState(false);
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
  const racChain = chainOf(rules?.rules ?? {}, "rac");
  const selector = racChain.find((stage) => stage !== "supervisor") ?? "dean";
  const canSelect = mayAct(session?.role, selector);
  const mayNominate = racChain.includes("supervisor");
  const vcStep = stageApplies(rules?.rules ?? {}, "rac", "vc");
  const canFinish =
    session?.role === "vc" ||
    session?.role === "admin" ||
    (session?.role === "dean" && !vcStep);
  const canEnter =
    session?.role === "admin" || session?.role === "staff" || session?.role === "dean";
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
    const nominees: RacNominee[] = slots
      .filter(
        ([slot]) =>
          !(optionalSlots as readonly string[]).includes(slot) || touched(values[slot]),
      )
      .map(([slot, , key, side]) => ({
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
    const internals = proposal.nominees.filter((item) => item.side === "internal");
    if (
      status === "Approved" &&
      (!picked.external || (internals.length > 1 && !picked.internal))
    ) {
      setNotice(
        internals.length > 1
          ? "Select one internal member and one external member."
          : "Select the external member.",
      );
      return;
    }
    if (status === "Returned" && note.length < 2) {
      setNotice("Enter the remarks before returning a nomination.");
      return;
    }
    if (status === "Approved" && minute.length < 2) {
      setNotice("Enter the minutes before forwarding.");
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
    setNotice(
      saved.ok
        ? status === "Approved"
          ? "The external member is selected and the RAC is sent to the Vice Chancellor."
          : "The nomination is returned to the supervisor."
        : saved.message,
    );
    if (saved.ok) setReviewing(null);
  }

  async function decideFinal(proposal: RacProposal, status: "Approved" | "Returned") {
    const note = (remarks[proposal.id] ?? "").trim();
    if (status === "Returned" && note.length < 2) {
      setNotice("Enter the remarks before returning a nomination.");
      return;
    }
    const saved = await decideRacFinal(proposal, { status, remarks: note });
    setNotice(
      saved.ok
        ? status === "Approved"
          ? "The RAC is approved."
          : "The nomination is returned to the supervisor."
        : saved.message,
    );
    if (saved.ok) setReviewing(null);
  }

  const officeScholars = (() => {
    if (!office || !canEnter) return [];
    const list = new Map<
      string,
      {
        identifier: string;
        name: string;
        supervisorIdentifier: string;
        supervisorName: string;
      }
    >();
    for (const item of office.allocations) {
      list.set(item.scholarIdentifier.toLowerCase(), {
        identifier: item.scholarIdentifier,
        name: item.scholarName,
        supervisorIdentifier: item.supervisorIdentifier,
        supervisorName: item.supervisorName,
      });
    }
    for (const scholar of researchRegister.scholars) {
      const id = scholarSignInId(scholar);
      if (!scholar.guideName.trim() || list.has(id.toLowerCase())) continue;
      const guide = supervisorForGuide(scholar.guideName);
      list.set(id.toLowerCase(), {
        identifier: id,
        name: scholar.name,
        supervisorIdentifier:
          guide?.email.trim() || guide?.supervisorId.trim() || scholar.guideName,
        supervisorName: scholar.guideName,
      });
    }
    return [...list.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  const filtered = office.proposals.filter(
    (proposal) =>
      filterMatches(kindFilter, proposal.kind) &&
      filterMatches(statusFilter, proposal.status) &&
      profile.matches(proposal.scholarIdentifier) &&
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
                        ? standing.pending.status === "With VC"
                          ? racCopy.withVc
                          : racCopy.waiting
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
                        {standing.pending.status === "Submitted" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startNomination(scholar)}
                          >
                            {racCopy.edit}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setMemo(standing.pending)}
                        >
                          {racCopy.printMemo}
                        </Button>
                      </>
                    ) : standing.canRequest && !mayNominate ? (
                      <p className="text-sm text-muted-foreground">
                        The research office enters the RAC now.
                      </p>
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
          {!canSelect && !canFinish ? (
            <p className="text-sm text-secondary">{racCopy.deanOnly}</p>
          ) : null}
          {canEnter ? (
            <div className="flex justify-end">
              <Button type="button" variant="gold" onClick={() => setEntering(true)}>
                Enter RAC details
              </Button>
            </div>
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
                options: ["Submitted", "With VC", "Approved", "Returned"].map((item) => ({
                  value: item,
                  label:
                    item === "Submitted"
                      ? "With the Dean"
                      : item === "With VC"
                        ? "With the Vice Chancellor"
                        : item,
                })),
                onChange: setStatusFilter,
              },
              ...profile.filters,
            ]}
            shown={filtered.length}
            total={office.proposals.length}
            filename="rac-nominations.csv"
            headers={["scholar", "supervisor", "kind", "status", "selected by", ...profile.headers]}
            rows={filtered.map((proposal) => [
              proposal.scholarName,
              proposal.supervisorName,
              proposal.kind,
              proposal.status,
              proposal.decidedBy,
              ...profile.cells(proposal.scholarIdentifier),
            ])}
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No RAC nominations yet.</p>
          ) : (
            filtered.map((proposal) => {
              const open = proposal.status === "Submitted" && canSelect;
              const openFinal = proposal.status === "With VC" && canFinish;
              const stage =
                proposal.status === "Submitted"
                  ? "With the Dean"
                  : proposal.status === "With VC"
                    ? "With the Vice Chancellor"
                    : proposal.status;
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
                      <div className="text-xs">
                        <ProfileCell profile={profile.profileOf(proposal.scholarIdentifier)} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Guide {proposal.supervisorName} ·{" "}
                        {formatIsoDate(proposal.createdAt.slice(0, 10))}
                        {proposal.officeEntry
                          ? ` · entered by ${proposal.enteredBy}`
                          : ""}
                        {proposal.decidedBy
                          ? ` · Dean ${proposal.decidedBy}${proposal.decidedOn ? ` on ${formatIsoDate(proposal.decidedOn)}` : ""}`
                          : ""}
                        {proposal.vcBy
                          ? ` · Vice Chancellor ${proposal.vcBy}${proposal.vcOn ? ` on ${formatIsoDate(proposal.vcOn)}` : ""}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {proposal.officeEntry &&
                      (session?.role === "admin" || session?.role === "staff") ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="maroon"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete the RAC entered for ${proposal.scholarName}? An entered RAC cannot be edited; enter it again if it was wrong.`,
                              )
                            )
                              return;
                            setNotice(null);
                            void deleteRacEntry(proposal).then((result) =>
                              setNotice(
                                result.ok
                                  ? `The RAC of ${proposal.scholarName} is deleted.`
                                  : result.message,
                              ),
                            );
                          }}
                        >
                          Delete
                        </Button>
                      ) : null}
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
                        {stage}
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
                      variant={open || openFinal ? "default" : "outline"}
                      data-readonly-allow
                      onClick={() => {
                        setNotice(null);
                        setReviewing(proposal.id);
                      }}
                    >
                      {open
                        ? "Review and select"
                        : openFinal
                          ? "Review and approve"
                          : "View nomination"}
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
                              <th className="px-2 py-2">Institution and address</th>
                              <th className="px-2 py-2">Contact and research</th>
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
                                    {nominee.side === "coguide" ? null : (
                                      <input
                                        type="radio"
                                        name={`${proposal.id}-${nominee.side}`}
                                        checked={selected}
                                        disabled={
                                          !open ||
                                          (nominee.side === "internal" &&
                                            proposal.nominees.filter(
                                              (item) => item.side === "internal",
                                            ).length === 1)
                                        }
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
                                    )}
                                  </td>
                                  <td className="px-2 py-2 capitalize">
                                    {nominee.side === "coguide"
                                      ? "co-guide"
                                      : nominee.side}
                                  </td>
                                  <td className="px-2 py-2">{nominee.name}</td>
                                  <td className="px-2 py-2">{nominee.designation}</td>
                                  <td className="px-2 py-2">
                                    {nominee.institution}
                                    {nominee.department ? `, ${nominee.department}` : ""}
                                    <p className="text-muted-foreground">
                                      {nominee.address}
                                    </p>
                                  </td>
                                  <td className="px-2 py-2">
                                    {nominee.email}
                                    <br />
                                    {nominee.phone}
                                    <br />
                                    {nominee.specialization}
                                    {nominee.publications.filter(Boolean).length > 0 ? (
                                      <ol className="mt-1 list-decimal pl-4 text-xs text-muted-foreground">
                                        {nominee.publications
                                          .filter(Boolean)
                                          .map((item, at) => (
                                            <li key={at}>{item}</li>
                                          ))}
                                      </ol>
                                    ) : null}
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
                      {proposal.vcRemarks ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Vice Chancellor: {proposal.vcRemarks}
                        </p>
                      ) : null}
                      {openFinal ? (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm">
                            The Dean selected{" "}
                            <strong>
                              {proposal.nominees.find(
                                (item) => item.key === proposal.selectedInternal,
                              )?.name ?? "the internal member"}
                            </strong>{" "}
                            as the internal member and{" "}
                            <strong>
                              {proposal.nominees.find(
                                (item) => item.key === proposal.selectedExternal,
                              )?.name ?? "the external member"}
                            </strong>{" "}
                            as the external member. Approve the RAC, or return it with
                            remarks.
                          </p>
                          <Textarea
                            aria-label="Remarks of the Vice Chancellor"
                            placeholder="Remarks (required to return)"
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
                              onClick={() => void decideFinal(proposal, "Approved")}
                            >
                              Approve the RAC
                            </Button>
                            <Button
                              type="button"
                              variant="maroon"
                              size="sm"
                              onClick={() => void decideFinal(proposal, "Returned")}
                            >
                              Return to supervisor
                            </Button>
                          </div>
                        </div>
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
                              Select and send to the Vice Chancellor
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
      {entering ? (
        <OfficeEntryDialog
          scholars={officeScholars}
          canRecord={session?.role === "admin" || session?.role === "staff"}
          onClose={() => setEntering(false)}
          onDone={(message) => {
            setNotice(message);
            setEntering(false);
          }}
        />
      ) : null}
    </div>
  );
}
