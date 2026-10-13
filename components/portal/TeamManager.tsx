"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { teamSeed } from "@/data/team";
import { field } from "@/lib/csv";
import { createSupabase } from "@/lib/supabase/client";
import {
  loadTeam,
  mapTeamMember,
  officeTeam,
  teamMigrationHint,
  type TeamLoad,
  type TeamMember,
} from "@/lib/team";

const teamColumns = ["sort_order", "role", "name"] as const;

const teamFormSchema = z.object({
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter the order.")
    .refine((value) => Number(value) >= 1, "Enter an order of 1 or more."),
  role: z.string().trim().min(2, "Enter the role."),
  name: z.string().trim(),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

const emptyForm: TeamFormValues = {
  sortOrder: "",
  role: "",
  name: "",
};

function toColumns(values: TeamFormValues) {
  return {
    sort_order: Number(values.sortOrder),
    role: values.role.trim(),
    name: values.name.trim(),
  };
}

export function TeamManager({ initial }: { initial: TeamLoad }) {
  const [members, setMembers] = useState<TeamMember[]>(
    initial.source === "empty" ? officeTeam() : initial.members,
  );
  const [source, setSource] = useState(initial.source);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initial.detail);
  const [busy, setBusy] = useState(false);

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: emptyForm,
  });

  const writable = source === "database" || source === "empty";

  function beginEdit(member: TeamMember) {
    setEditingId(member.id);
    form.reset({
      sortOrder: String(member.sortOrder),
      role: member.role,
      name: member.name,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    form.reset(emptyForm);
  }

  async function refresh() {
    const loaded = await loadTeam();
    setSource(loaded.source);
    setMembers(loaded.source === "empty" ? officeTeam() : loaded.members);
    setNotice(loaded.detail);
  }

  async function publishOfficeList() {
    const supabase = createSupabase();
    if (!supabase) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.from("research_team").insert(
      teamSeed.map((member) => ({
        sort_order: member.sortOrder,
        role: member.role,
        name: member.name,
      })),
    );
    setBusy(false);
    if (error) {
      setNotice("The team could not be saved. Run the SQL migration, then try again.");
      return;
    }
    await refresh();
  }

  async function onSubmit(values: TeamFormValues) {
    const supabase = createSupabase();
    if (!supabase || source === "office-copy") return;
    setBusy(true);
    setNotice(null);
    const columns = toColumns(values);

    if (editingId && !editingId.startsWith("office-")) {
      const { data, error } = await supabase
        .from("research_team")
        .update(columns)
        .eq("id", editingId)
        .select("id, sort_order, role, name")
        .single();
      setBusy(false);
      if (error || !data) {
        setNotice("That member could not be updated. The order may already be used.");
        return;
      }
      const next = mapTeamMember(data);
      setMembers((current) =>
        current
          .map((member) => (member.id === editingId ? next : member))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
      cancelEdit();
      return;
    }

    const { data, error } = await supabase
      .from("research_team")
      .insert(columns)
      .select("id, sort_order, role, name")
      .single();
    setBusy(false);
    if (error || !data) {
      setNotice("That member could not be added. The order may already be used.");
      return;
    }
    setMembers((current) =>
      [...current, mapTeamMember(data)].sort((a, b) => a.sortOrder - b.sortOrder),
    );
    cancelEdit();
  }

  async function remove(member: TeamMember) {
    if (member.id.startsWith("office-")) return;
    const supabase = createSupabase();
    if (!supabase) return;
    const label = member.name || member.role;
    if (!window.confirm(`Remove ${label} from Our Team?`)) return;
    setBusy(true);
    const { error } = await supabase.from("research_team").delete().eq("id", member.id);
    setBusy(false);
    if (error) {
      setNotice("That member could not be removed.");
      return;
    }
    setMembers((current) => current.filter((item) => item.id !== member.id));
    if (editingId === member.id) cancelEdit();
  }

  async function uploadCsv(records: Record<string, string>[]) {
    if (source !== "database" && source !== "empty") {
      setNotice("Save the team table in Supabase before uploading a CSV.");
      return;
    }
    const supabase = createSupabase();
    if (!supabase) return;
    setBusy(true);
    setNotice(null);
    const known = new Map(
      members
        .filter((member) => !member.id.startsWith("office-"))
        .map((member) => [member.sortOrder, member.id]),
    );
    let added = 0;
    let updated = 0;
    const problems: string[] = [];

    for (const [index, record] of records.entries()) {
      const parsed = teamFormSchema.safeParse({
        sortOrder: field(record, ["sort_order", "order"]),
        role: field(record, ["role"]),
        name: field(record, ["name"]),
      });
      if (!parsed.success) {
        problems.push(
          `Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "Check this row."}`,
        );
        continue;
      }
      const columns = toColumns(parsed.data);
      const existingId = known.get(columns.sort_order);
      if (existingId) {
        const { error } = await supabase
          .from("research_team")
          .update(columns)
          .eq("id", existingId);
        if (error) problems.push(`Row ${index + 2} could not be updated.`);
        else updated += 1;
        continue;
      }
      const { data, error } = await supabase
        .from("research_team")
        .insert(columns)
        .select("id")
        .single();
      if (error || !data) {
        problems.push(
          `Row ${index + 2} could not be added. That order may already be used.`,
        );
        continue;
      }
      known.set(columns.sort_order, data.id);
      added += 1;
    }

    setBusy(false);
    await refresh();
    const summary = `Added ${added} and updated ${updated} from the CSV.`;
    setNotice(problems.length ? `${summary} ${problems.slice(0, 3).join(" ")}` : summary);
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Our Team</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {members.length} members. Changes appear on the public Our Team page. Download the
        list as CSV, or upload a CSV to add and update members. Removing a member stays on
        the Remove button.
      </p>
      <SpreadsheetBar
        filename="research-team.csv"
        headers={teamColumns}
        rows={members.map((member) => [
          String(member.sortOrder),
          member.role,
          member.name,
        ])}
        canUpload={writable}
        busy={busy}
        onUpload={(records) => void uploadCsv(records)}
        onError={setNotice}
      />
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {notice} {source === "office-copy" ? teamMigrationHint : ""}
        </p>
      ) : null}

      {source === "empty" ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm leading-6 text-muted-foreground">
            The database has no team members yet. Save the office list, then edit it here.
          </p>
          <Button
            type="button"
            variant="gold"
            className="mt-4"
            disabled={busy}
            onClick={() => void publishOfficeList()}
          >
            Save the office list
          </Button>
        </div>
      ) : null}

      {writable && source === "database" ? (
        <form
          className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <h2 className="font-semibold text-primary sm:col-span-2">
            {editingId ? "Edit member" : "Add member"}
          </h2>
          <FormField
            label="Order"
            htmlFor="sortOrder"
            required
            error={form.formState.errors.sortOrder?.message}
          >
            <Input id="sortOrder" inputMode="numeric" {...form.register("sortOrder")} />
          </FormField>
          <FormField
            label="Name"
            htmlFor="memberName"
            error={form.formState.errors.name?.message}
          >
            <Input id="memberName" {...form.register("name")} />
          </FormField>
          <FormField
            label="Role"
            htmlFor="memberRole"
            required
            error={form.formState.errors.role?.message}
            className="sm:col-span-2"
          >
            <Input id="memberRole" {...form.register("role")} />
          </FormField>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="gold" disabled={busy}>
              {editingId ? "Save member" : "Add member"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                Order
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Role
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-border">
                <td className="px-4 py-3">{member.sortOrder}</td>
                <td className="px-4 py-3 font-medium text-primary">{member.role}</td>
                <td className="px-4 py-3">{member.name || "—"}</td>
                <td className="px-4 py-3">
                  {writable && source === "database" ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => beginEdit(member)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void remove(member)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
