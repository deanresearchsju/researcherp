"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FileUpload } from "@/components/forms/FileUpload";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { SpreadsheetBar } from "@/components/portal/SpreadsheetBar";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { teamSeed } from "@/data/team";
import { field } from "@/lib/csv";
import { fileError, fileToDataUrl, releaseFile, type StoredFile } from "@/lib/files";
import { createSupabase } from "@/lib/supabase/client";
import {
  loadTeam,
  mapTeamMember,
  officeTeam,
  teamContactMigrationHint,
  teamMigrationHint,
  teamSelect,
  type TeamLoad,
  type TeamMember,
} from "@/lib/team";

const teamColumns = ["sort_order", "role", "name", "email", "phone"] as const;

const teamFormSchema = z.object({
  sortOrder: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter the order.")
    .refine((value) => Number(value) >= 1, "Enter an order of 1 or more."),
  role: z.string().trim().min(2, "Enter the role."),
  name: z.string().trim(),
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email address.",
    ),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^[0-9+\-\s()]{6,20}$/.test(value),
      "Enter a valid phone number.",
    ),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

const emptyForm: TeamFormValues = {
  sortOrder: "",
  role: "",
  name: "",
  email: "",
  phone: "",
};

function toColumns(values: TeamFormValues, photo: string) {
  return {
    sort_order: Number(values.sortOrder),
    role: values.role.trim(),
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    photo,
  };
}

function saveNotice(message: string) {
  if (/email|phone|photo|column|schema cache/i.test(message)) {
    return teamContactMigrationHint;
  }
  return null;
}

export function TeamManager({ initial }: { initial: TeamLoad }) {
  const [members, setMembers] = useState<TeamMember[]>(
    initial.source === "empty" ? officeTeam() : initial.members,
  );
  const [source, setSource] = useState(initial.source);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initial.detail);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [photoFile, setPhotoFile] = useState<StoredFile | null>(null);
  const [keptPhoto, setKeptPhoto] = useState("");
  const [photoError, setPhotoError] = useState("");

  const form = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: emptyForm,
  });

  const writable = source === "database" || source === "empty";

  function clearPhoto() {
    releaseFile(photoFile);
    setPhotoFile(null);
    setKeptPhoto("");
    setPhotoError("");
  }

  function beginEdit(member: TeamMember) {
    releaseFile(photoFile);
    setPhotoFile(null);
    setPhotoError("");
    setKeptPhoto(member.photo);
    setEditingId(member.id);
    form.reset({
      sortOrder: String(member.sortOrder),
      role: member.role,
      name: member.name,
      email: member.email,
      phone: member.phone,
    });
  }

  function cancelEdit() {
    clearPhoto();
    setEditingId(null);
    form.reset(emptyForm);
  }

  async function chosenPhoto() {
    if (!photoFile) return keptPhoto;
    const problem = fileError(photoFile.file, "teamPhoto", false);
    if (problem) {
      setPhotoError(problem);
      return null;
    }
    setPhotoError("");
    return fileToDataUrl(photoFile.file);
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
        email: member.email,
        phone: member.phone,
        photo: member.photo,
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
    const photo = await chosenPhoto();
    if (photo === null) {
      setBusy(false);
      return;
    }
    const columns = toColumns(values, photo);

    if (editingId && !editingId.startsWith("office-")) {
      const { data, error } = await supabase
        .from("research_team")
        .update(columns)
        .eq("id", editingId)
        .select(teamSelect)
        .single();
      setBusy(false);
      if (error || !data) {
        setNotice(
          (error ? saveNotice(error.message) : null) ??
            "That member could not be updated. The order may already be used.",
        );
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
      .select(teamSelect)
      .single();
    setBusy(false);
    if (error || !data) {
      setNotice(
        (error ? saveNotice(error.message) : null) ??
          "That member could not be added. The order may already be used.",
      );
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
        email: field(record, ["email", "mail"]),
        phone: field(record, ["phone", "mobile"]),
      });
      if (!parsed.success) {
        problems.push(
          `Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "Check this row."}`,
        );
        continue;
      }
      const existing = members.find((member) => member.sortOrder === Number(parsed.data.sortOrder));
      const columns = toColumns(parsed.data, existing?.photo ?? "");
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

  const visible = members.filter(
    (member) =>
      (roleFilter === "" || member.role === roleFilter) &&
      textMatches(query, [
        member.role,
        member.name,
        member.email,
        member.phone,
        String(member.sortOrder),
      ]),
  );
  const roleOptions = [...new Set(members.map((member) => member.role))].sort();

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Our Team</h1>
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "role",
            label: "Role",
            value: roleFilter,
            options: roleOptions.map((role) => ({ value: role, label: role })),
            onChange: setRoleFilter,
          },
        ]}
        shown={visible.length}
        total={members.length}
        filename="research-team-filtered.csv"
        headers={teamColumns}
        rows={visible.map((member) => [
          String(member.sortOrder),
          member.role,
          member.name,
          member.email,
          member.phone,
        ])}
      />
      <SpreadsheetBar
        filename="research-team.csv"
        headers={teamColumns}
        rows={visible.map((member) => [
          String(member.sortOrder),
          member.role,
          member.name,
          member.email,
          member.phone,
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
          <FormField
            label="Email"
            htmlFor="memberEmail"
            error={form.formState.errors.email?.message}
          >
            <Input id="memberEmail" type="email" autoComplete="off" {...form.register("email")} />
          </FormField>
          <FormField
            label="Phone"
            htmlFor="memberPhone"
            error={form.formState.errors.phone?.message}
          >
            <Input id="memberPhone" type="tel" autoComplete="off" {...form.register("phone")} />
          </FormField>
          <FormField label="Photograph" htmlFor="memberPhoto" error={photoError} className="sm:col-span-2">
            <FileUpload
              id="memberPhoto"
              acceptRule="teamPhoto"
              value={photoFile}
              error={photoError}
              onChange={(next) => {
                releaseFile(photoFile);
                setPhotoFile(next);
                setPhotoError("");
                if (next) setKeptPhoto("");
              }}
            />
            {keptPhoto && !photoFile ? (
              <div className="flex items-center gap-3">
                {/* Stored team photograph; next/image cannot serve a data URL. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={keptPhoto}
                  alt=""
                  className="aspect-[7/9] w-20 rounded-lg border border-border object-contain"
                />
                <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                  Remove photograph
                </Button>
              </div>
            ) : null}
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
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Phone
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Photograph
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((member) => (
              <tr key={member.id} className="border-t border-border">
                <td className="px-4 py-3">{member.sortOrder}</td>
                <td className="px-4 py-3 font-medium text-primary">{member.role}</td>
                <td className="px-4 py-3">{member.name || "—"}</td>
                <td className="px-4 py-3">{member.email || "—"}</td>
                <td className="px-4 py-3">{member.phone || "—"}</td>
                <td className="px-4 py-3">
                  {member.photo ? (
                    // Stored team photograph; next/image cannot serve a data URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photo}
                      alt=""
                      className="aspect-[7/9] w-12 rounded-md border border-border object-contain"
                    />
                  ) : (
                    "—"
                  )}
                </td>
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
