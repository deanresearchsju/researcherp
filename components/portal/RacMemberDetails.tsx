"use client";

import { formatIsoDate } from "@/lib/dates";
import { presentRac, type RacNominee, type RacProposal } from "@/lib/office";

/** The name of a nominee chosen on a RAC proposal (the proposal stores the nominee's key). */
export function racMemberName(proposal: RacProposal, key: string, side: RacNominee["side"]) {
  if (key) {
    const chosen = proposal.nominees.find((item) => item.key === key);
    if (chosen) return chosen.name;
  }
  return proposal.nominees
    .filter((item) => item.side === side)
    .map((item) => item.name)
    .join(", ");
}

function Member({ role, member }: { role: string; member: RacNominee }) {
  const facts: [string, string][] = [
    ["Designation", member.designation],
    ["Department", member.department],
    ["Institution", member.institution],
    ["Area of research", member.specialization],
    ["Email", member.email],
    ["Phone", member.phone],
    ["Address", member.address],
  ];
  return (
    <li className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
        {role}
      </p>
      <p className="mt-1 font-semibold text-primary">{member.name || "—"}</p>
      <dl className="mt-2 space-y-1 text-sm">
        {facts
          .filter(([, value]) => value?.trim())
          .map(([label, value]) => (
            <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="break-words">
                {label === "Email" ? (
                  <a href={`mailto:${value}`} className="text-primary hover:underline">
                    {value}
                  </a>
                ) : label === "Phone" ? (
                  <a href={`tel:${value}`} className="text-primary hover:underline">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
      </dl>
    </li>
  );
}

/** The RAC in force for a scholar: the guide, the internal and the external member, with details. */
export function RacMemberDetails({
  proposals,
  scholarIdentifier,
}: {
  proposals: readonly RacProposal[];
  scholarIdentifier: string;
}) {
  const present = presentRac([...proposals], scholarIdentifier);
  if (!present) {
    return <p className="text-sm text-muted-foreground">No RAC has been approved yet.</p>;
  }
  return (
    <div>
      <ul className="grid gap-3 lg:grid-cols-3">
        <li className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-[0.65rem] font-bold tracking-[0.16em] text-secondary uppercase">
            Guide / Supervisor
          </p>
          <p className="mt-1 font-semibold text-primary">{present.guide || "—"}</p>
          <p className="mt-2 text-sm text-muted-foreground">Convener of the RAC</p>
        </li>
        <Member role="Internal member" member={present.internal} />
        <Member role="External member" member={present.external} />
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Constituted on {formatIsoDate(present.approvedOn.slice(0, 10))}
        {present.selectedBy ? ` · selected by ${present.selectedBy}` : ""}
      </p>
    </div>
  );
}
