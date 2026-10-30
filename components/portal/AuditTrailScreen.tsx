"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useClientReady } from "@/components/forms/ClientGate";
import {
  DeskPage,
  DeskPager,
  DeskSection,
  DeskTable,
  DeskTabs,
  GateBanner,
} from "@/components/portal/Desk";
import { ListToolbar, filterMatches, textMatches } from "@/components/portal/ListToolbar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { AuditEntry } from "@/lib/audit";
import {
  actionLabel,
  auditModules,
  auditTime,
  kindOf,
  loadAuditTrail,
  moduleLabel,
  type AuditKind,
} from "@/lib/audit-view";
import { clientToday } from "@/lib/dates";
import { pageCount, pageSlice } from "@/lib/paging";
import { scholarBySignIn, supervisorBySignIn } from "@/lib/register";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import { usePreviewSession } from "@/lib/use-preview-session";
import { roleNames } from "@/data/roles";
import type { Role } from "@/types";

const pageSize = 50;
const batch = 500;
const kinds: AuditKind[] = ["Submitted", "Approved", "Returned", "Sign-in", "Changed"];

const roleOptions = Object.entries(roleNames).map(([value, label]) => ({
  value,
  label,
}));

/**
 * The audit trail: every submission, approval, return, entry, change and sign-in with who did it
 * and when. The server writes the person and the time, so a line cannot be made in another
 * person's name. The administrator can follow one scholar, supervisor or staff member, see what
 * each user has done, and download the list as Excel or PDF.
 */
export function AuditTrailScreen() {
  const ready = useClientReady();
  const session = usePreviewSession();
  const asked = useSearchParams().get("person") ?? "";
  const users = useSyncExternalStore(subscribePortalUsers, currentPortalUsers, () => null);
  const [tab, setTab] = useState("log");
  const [person, setPerson] = useState(asked);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [role, setRole] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [applied, setApplied] = useState({
    person: asked,
    from: "",
    to: "",
    role: "",
    module: "",
  });
  const [limit, setLimit] = useState(batch);
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [page, setPage] = useState(1);

  const isAdmin = session?.role === "admin";

  useEffect(() => {
    if (!ready || !isAdmin) return;
    let cancelled = false;
    void loadAuditTrail(applied, limit).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setProblem(result.message);
        setRows([]);
        return;
      }
      setProblem(null);
      setRows(result.rows);
      setMore(result.more);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, isAdmin, applied, limit]);

  const nameOf = useMemo(() => {
    const known = new Map<string, string>();
    for (const user of users?.users ?? []) {
      known.set(user.identifier.trim().toLowerCase(), user.name);
    }
    return (identifier: string) => {
      const key = identifier.trim().toLowerCase();
      return (
        known.get(key) ??
        scholarBySignIn(identifier)?.name ??
        supervisorBySignIn(identifier)?.name ??
        ""
      );
    };
  }, [users]);

  if (!ready || !session) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!isAdmin) {
    return (
      <DeskPage kicker="Administration" title="Audit trail">
        <GateBanner tone="danger">Only the administrator can read the audit trail.</GateBanner>
      </DeskPage>
    );
  }

  const all = rows ?? [];
  const visible = all.filter(
    (row) =>
      filterMatches(kindFilter, kindOf(row.action)) &&
      textMatches(query, [
        row.actorIdentifier,
        nameOf(row.actorIdentifier),
        row.action,
        actionLabel(row.action),
        row.subject,
        row.detail,
      ]),
  );
  const pages = pageCount(visible.length, pageSize);
  const shown = pageSlice(visible, Math.min(page, pages), pageSize);

  const roleLabel = (value: string) => roleNames[value as Role] ?? value;

  // What each user did, from the lines read.
  const byUser = new Map<
    string,
    {
      identifier: string;
      role: string;
      total: number;
      last: string;
      counts: Record<AuditKind, number>;
    }
  >();
  for (const row of visible) {
    const key = `${row.actorRole}:${row.actorIdentifier.toLowerCase()}`;
    const entry = byUser.get(key) ?? {
      identifier: row.actorIdentifier,
      role: row.actorRole,
      total: 0,
      last: row.at,
      counts: { Submitted: 0, Approved: 0, Returned: 0, "Sign-in": 0, Changed: 0 },
    };
    entry.total += 1;
    entry.counts[kindOf(row.action)] += 1;
    if (row.at > entry.last) entry.last = row.at;
    byUser.set(key, entry);
  }
  const users_ = [...byUser.values()].sort((a, b) => b.total - a.total);

  const criteria = [
    applied.person ? `Person: ${applied.person}` : "",
    applied.from || applied.to
      ? `Dates: ${applied.from || "the start"} to ${applied.to || "today"}`
      : "",
    applied.role ? `Done by: ${roleLabel(applied.role)}` : "",
    applied.module ? `Module: ${auditModules[applied.module] ?? applied.module}` : "",
  ].filter(Boolean);

  function apply(event?: React.FormEvent) {
    event?.preventDefault();
    setPage(1);
    setRows(null);
    setLimit(batch);
    setApplied({
      person: person.trim(),
      from,
      to,
      role,
      module: moduleFilter,
    });
  }

  function follow(identifier: string) {
    setPerson(identifier);
    setTab("log");
    setPage(1);
    setRows(null);
    setLimit(batch);
    setApplied({ person: identifier, from, to, role, module: moduleFilter });
  }

  const moduleOptions = [
    ...new Map(
      Object.entries(auditModules).map(([key, label]) => [label, key] as const),
    ).entries(),
  ].map(([label, key]) => ({ value: key, label }));

  return (
    <DeskPage kicker="Administration" title="Audit trail">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Every submission, approval, return, entry, correction and sign-in is recorded with
        who did it and when. The person and the time are written by the server, so a line
        cannot be made in another person&apos;s name, and no line can be changed or removed.
        Enter a scholar&apos;s or supervisor&apos;s name, e-mail or number to follow what they
        did and what was done for them.
      </p>

      <form
        onSubmit={apply}
        className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      >
        <FormField label="Person" htmlFor="audit-person" className="lg:col-span-2">
          <Input
            id="audit-person"
            value={person}
            placeholder="Name, e-mail or number"
            onChange={(event) => setPerson(event.target.value)}
          />
        </FormField>
        <FormField label="From" htmlFor="audit-from">
          <Input
            id="audit-from"
            type="date"
            max={clientToday()}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </FormField>
        <FormField label="To" htmlFor="audit-to">
          <Input
            id="audit-to"
            type="date"
            max={clientToday()}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </FormField>
        <FormField label="Done by" htmlFor="audit-role">
          <NativeSelect
            id="audit-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="">Everyone</option>
            {roleOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Part of the ERP" htmlFor="audit-module" className="lg:col-span-2">
          <NativeSelect
            id="audit-module"
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
          >
            <option value="">All</option>
            {moduleOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="flex items-end gap-2 lg:col-span-3">
          <Button type="submit" variant="gold">
            Show
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPerson("");
              setFrom("");
              setTo("");
              setRole("");
              setModuleFilter("");
              setPage(1);
              setRows(null);
              setLimit(batch);
              setApplied({ person: "", from: "", to: "", role: "", module: "" });
            }}
          >
            Clear
          </Button>
        </div>
      </form>

      {problem ? <GateBanner tone="danger">{problem}</GateBanner> : null}

      <DeskTabs
        tabs={[
          { id: "log", label: "Activity log" },
          { id: "users", label: "By user" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <ListToolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        filters={[
          {
            id: "kind",
            label: "Kind of act",
            value: kindFilter,
            options: kinds.map((value) => ({ value, label: value })),
            onChange: (value) => {
              setKindFilter(value);
              setPage(1);
            },
          },
        ]}
        shown={visible.length}
        total={all.length}
        filename={tab === "users" ? "audit-by-user.csv" : "audit-trail.csv"}
        title={tab === "users" ? "Audit trail · by user" : "Audit trail"}
        criteria={criteria}
        headers={
          tab === "users"
            ? [
                "User",
                "Sign-in",
                "Role",
                "Actions",
                "Submitted",
                "Approved",
                "Returned",
                "Sign-ins",
                "Other changes",
                "Last action",
              ]
            : ["When", "Done by", "Sign-in", "Role", "Part of the ERP", "What", "For", "Details"]
        }
        rows={
          tab === "users"
            ? users_.map((item) => [
                nameOf(item.identifier) || item.identifier,
                item.identifier,
                roleLabel(item.role),
                String(item.total),
                String(item.counts.Submitted),
                String(item.counts.Approved),
                String(item.counts.Returned),
                String(item.counts["Sign-in"]),
                String(item.counts.Changed),
                auditTime(item.last),
              ])
            : visible.map((row) => [
                auditTime(row.at),
                nameOf(row.actorIdentifier) || row.actorIdentifier,
                row.actorIdentifier,
                roleLabel(row.actorRole),
                moduleLabel(row.action),
                actionLabel(row.action),
                nameOf(row.subject) ? `${nameOf(row.subject)} (${row.subject})` : row.subject,
                row.detail,
              ])
        }
      />

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Reading the audit trail…</p>
      ) : tab === "users" ? (
        <DeskSection title="What each user has done">
          <DeskTable
            headers={[
              "User",
              "Role",
              "Actions",
              "Submitted",
              "Approved",
              "Returned",
              "Sign-ins",
              "Other",
              "Last action",
              "",
            ]}
            empty={users_.length === 0}
          >
            {users_.map((item) => (
              <tr
                key={`${item.role}:${item.identifier}`}
                className="border-t border-border align-top"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-primary">
                    {nameOf(item.identifier) || item.identifier}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.identifier}
                  </p>
                </td>
                <td className="px-4 py-3">{roleLabel(item.role)}</td>
                <td className="px-4 py-3 font-semibold">{item.total}</td>
                <td className="px-4 py-3">{item.counts.Submitted}</td>
                <td className="px-4 py-3">{item.counts.Approved}</td>
                <td className="px-4 py-3">{item.counts.Returned}</td>
                <td className="px-4 py-3">{item.counts["Sign-in"]}</td>
                <td className="px-4 py-3">{item.counts.Changed}</td>
                <td className="px-4 py-3">{auditTime(item.last)}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => follow(item.identifier)}
                  >
                    Follow
                  </Button>
                </td>
              </tr>
            ))}
          </DeskTable>
        </DeskSection>
      ) : (
        <DeskSection title="Activity log">
          <DeskTable
            headers={["When", "Done by", "What", "For", "Details"]}
            empty={shown.rows.length === 0}
          >
            {shown.rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-4 py-3 whitespace-nowrap">{auditTime(row.at)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-primary">
                    {nameOf(row.actorIdentifier) || row.actorIdentifier}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel(row.actorRole)} · {row.actorIdentifier}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{actionLabel(row.action)}</p>
                  <p className="text-xs text-muted-foreground">{moduleLabel(row.action)}</p>
                </td>
                <td className="px-4 py-3">
                  {nameOf(row.subject) ? (
                    <>
                      <p>{nameOf(row.subject)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{row.subject}</p>
                    </>
                  ) : (
                    <span className="font-mono text-xs break-all">{row.subject || "—"}</span>
                  )}
                </td>
                <td className="max-w-md px-4 py-3 text-muted-foreground">
                  {row.detail || "—"}
                </td>
              </tr>
            ))}
          </DeskTable>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3">
            <DeskPager
              page={Math.min(page, pages)}
              pageCount={pages}
              label={`Lines ${visible.length === 0 ? 0 : shown.start}–${shown.end} of ${visible.length}`}
              onPage={setPage}
            />
            {more ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setRows(null);
                  setLimit((value) => value + batch);
                }}
              >
                Read {batch} older lines
              </Button>
            ) : null}
          </div>
        </DeskSection>
      )}
    </DeskPage>
  );
}
