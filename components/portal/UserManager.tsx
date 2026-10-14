"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { ProfilePhotoChange } from "@/components/portal/ProfileCard";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { portalGroups } from "@/data/portal";
import { roleProfiles } from "@/data/roles";
import { isPrincipalAdmin, menuHrefs, storedMenus } from "@/lib/access";
import {
  activateRegisterAccounts,
  type ActivationReport,
} from "@/lib/register-access";
import {
  createPortalUser,
  removePortalUser,
  updatePortalUser,
  userMigrationHint,
  type PortalUser,
  type UserLoad,
} from "@/lib/users";

const userFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the name."),
  password: z
    .string()
    .refine(
      (value) => value.length === 0 || (value.length >= 6 && value.length <= 128),
      "Password must be at least 6 characters.",
    ),
});

type UserFormValues = z.infer<typeof userFormSchema>;

const accessRoles = ["scholar", "supervisor", "admin"] as const;

const createFormSchema = z.object({
  role: z.enum(accessRoles),
  name: z.string().trim().min(2, "Enter the name."),
  identifier: z.string().trim().min(3, "Enter the sign-in id."),
  password: z.string().min(6, "Password must be at least 6 characters.").max(128),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

function activationNotice(report: ActivationReport) {
  const parts = [
    report.created > 0 ? `${report.created} sign-ins are now active.` : null,
    report.alreadyActive > 0 ? `${report.alreadyActive} already had sign-in.` : null,
    "The sign-in id is the mail id. They receive a first password from the office, choose a new one the first time they sign in, then fill personal details that are still blank.",
  ];
  if (report.scholarsWithoutEmail > 0) {
    parts.push(
      `${report.scholarsWithoutEmail} scholars have no mail id, so their sign-in is not active.`,
    );
  }
  if (report.supervisorsWithoutEmail > 0) {
    parts.push(
      `${report.supervisorsWithoutEmail} supervisors have no mail id on the register, so their sign-in is not active.`,
    );
  }
  return parts.filter((part) => part).join(" ");
}

export function UserManager({ initial }: { initial: UserLoad }) {
  const [users, setUsers] = useState(initial.users);
  const [source, setSource] = useState(initial.source);
  const [detail, setDetail] = useState(initial.detail);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", password: "" },
  });
  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { role: "scholar", name: "", identifier: "", password: "" },
  });
  const createRole = useWatch({ control: createForm.control, name: "role" });
  const [menuRole, setMenuRole] = useState<(typeof accessRoles)[number]>("scholar");
  const [selectedMenus, setSelectedMenus] = useState<string[]>(menuHrefs("scholar"));
  const [editMenus, setEditMenus] = useState<string[]>([]);
  const [issued, setIssued] = useState<ActivationReport["issued"]>([]);
  if (createRole !== menuRole) {
    setMenuRole(createRole);
    setSelectedMenus(menuHrefs(createRole));
  }

  function toggleMenu(current: string[], href: string, checked: boolean) {
    if (href.endsWith("/dashboard")) return current;
    return checked ? [...current, href] : current.filter((item) => item !== href);
  }

  function beginEdit(user: PortalUser) {
    setEditingId(user.id);
    form.reset({ name: user.name, password: "" });
    setEditMenus(user.menus ?? menuHrefs(user.role));
  }

  function cancelEdit() {
    setEditingId(null);
    form.reset({ name: "", password: "" });
  }

  async function onSubmit(values: UserFormValues) {
    const current = users.find((user) => user.id === editingId);
    if (!current) return;
    setBusy(true);
    setNotice(null);
    const saved = await updatePortalUser(
      current,
      {
        name: values.name,
        password: values.password || current.password,
        mustReset: values.password
          ? values.password !== current.password || current.mustReset
          : current.mustReset,
        menus: isPrincipalAdmin(current) ? null : storedMenus(current.role, editMenus),
      },
      source,
    );
    setBusy(false);
    if (!saved.ok) {
      setNotice("That user could not be updated.");
      return;
    }
    setUsers((list) => list.map((user) => (user.id === current.id ? saved.user : user)));
    cancelEdit();
    setNotice(
      saved.user.mustReset
        ? `Updated ${saved.user.name}. They must choose a new password at the next sign-in.`
        : `Updated ${saved.user.name}.`,
    );
  }

  async function onCreate(values: CreateFormValues) {
    setBusy(true);
    setNotice(null);
    const saved = await createPortalUser(
      { ...values, menus: storedMenus(values.role, selectedMenus) },
      source,
    );
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    setUsers((list) => [...list, saved.user]);
    createForm.reset({ role: "scholar", name: "", identifier: "", password: "" });
    setNotice(
      `${saved.user.name} can sign in as ${roleProfiles[saved.user.role].label} with ${saved.user.identifier}. They choose a new password the first time they sign in.`,
    );
  }

  async function remove(user: PortalUser) {
    if (isPrincipalAdmin(user)) return;
    if (!window.confirm(`Remove access for ${user.name}?`)) return;
    setBusy(true);
    setNotice(null);
    const saved = await removePortalUser(user, source);
    setBusy(false);
    if (!saved.ok) {
      setNotice("That user could not be removed.");
      return;
    }
    setUsers((list) => list.filter((item) => item.id !== user.id));
    if (editingId === user.id) cancelEdit();
    setNotice(`Removed access for ${user.name}.`);
  }

  async function activateScholars() {
    setBusy(true);
    setNotice(null);
    const report = await activateRegisterAccounts();
    setBusy(false);
    setUsers(report.load.users);
    setSource(report.load.source);
    setDetail(report.load.detail);
    setIssued(report.issued);
    setNotice(activationNotice(report));
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Users</h1>
      <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-semibold text-primary">Register sign-in</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Scholar and supervisor sign-in uses the mail id on the register. The office
          issues a first password. The first visit asks for a new password, then for any
          personal details that are still blank. Existing sign-ins keep the password they
          already have. A person with no mail id on the register stays inactive.
        </p>
        <Button
          type="button"
          variant="gold"
          className="mt-4"
          disabled={busy}
          onClick={() => void activateScholars()}
        >
          Activate register sign-in
        </Button>
      </section>
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {notice}
        </p>
      ) : null}
      {issued.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-sm font-semibold text-primary">
            First passwords for new sign-ins. Copy them now; they are not shown again.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {issued.map((row) => (
              <li key={row.identifier}>
                {row.identifier} · {row.password}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {detail ? (
        <p className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {detail} {source === "browser" ? userMigrationHint : ""}
        </p>
      ) : null}

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[
          {
            id: "role",
            label: "Access",
            value: roleFilter,
            options: (["scholar", "supervisor", "admin"] as const).map((role) => ({
              value: role,
              label: roleProfiles[role].label,
            })),
            onChange: setRoleFilter,
          },
        ]}
        shown={
          users.filter(
            (user) =>
              (roleFilter === "" || user.role === roleFilter) &&
              textMatches(query, [user.name, user.identifier, user.role]),
          ).length
        }
        total={users.length}
        filename="users.csv"
        headers={["role", "name", "identifier"]}
        rows={users
          .filter(
            (user) =>
              (roleFilter === "" || user.role === roleFilter) &&
              textMatches(query, [user.name, user.identifier, user.role]),
          )
          .map((user) => [user.role, user.name, user.identifier])}
      />

      <form
        className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2"
        onSubmit={createForm.handleSubmit(onCreate)}
        noValidate
      >
        <h2 className="font-semibold text-primary sm:col-span-2">Create user</h2>
        <FormField
          label="Access"
          htmlFor="createRole"
          required
          error={createForm.formState.errors.role?.message}
        >
          <NativeSelect id="createRole" {...createForm.register("role")}>
            {accessRoles.map((role) => (
              <option key={role} value={role}>
                {roleProfiles[role].label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label="Name"
          htmlFor="createName"
          required
          error={createForm.formState.errors.name?.message}
        >
          <Input id="createName" {...createForm.register("name")} />
        </FormField>
        <FormField
          label="Sign-in id"
          htmlFor="createIdentifier"
          required
          error={createForm.formState.errors.identifier?.message}
        >
          <Input id="createIdentifier" {...createForm.register("identifier")} />
        </FormField>
        <FormField
          label="Password"
          htmlFor="createPassword"
          required
          error={createForm.formState.errors.password?.message}
        >
          <Input
            id="createPassword"
            type="password"
            autoComplete="new-password"
            {...createForm.register("password")}
          />
        </FormField>
        <MenuPicker
          role={createRole}
          selected={selectedMenus}
          onToggle={(href, checked) =>
            setSelectedMenus((current) => toggleMenu(current, href, checked))
          }
        />
        <div className="sm:col-span-2">
          <Button type="submit" variant="gold" disabled={busy}>
            Give access
          </Button>
        </div>
      </form>

      {editingId ? (
        <form
          className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <h2 className="font-semibold text-primary sm:col-span-2">Reset user</h2>
          <FormField
            label="Name"
            htmlFor="userName"
            required
            error={form.formState.errors.name?.message}
          >
            <Input id="userName" {...form.register("name")} />
          </FormField>
          <FormField
            label="Password"
            htmlFor="userPassword"
            error={form.formState.errors.password?.message}
          >
            <Input
              id="userPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep the current password"
              {...form.register("password")}
            />
          </FormField>
          {editingId &&
          !isPrincipalAdmin(
            users.find((user) => user.id === editingId) ?? {
              role: "scholar",
              identifier: "",
            },
          ) ? (
            <MenuPicker
              role={users.find((user) => user.id === editingId)?.role ?? "scholar"}
              selected={editMenus}
              onToggle={(href, checked) =>
                setEditMenus((current) => toggleMenu(current, href, checked))
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              This sign-in keeps every menu.
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="gold" disabled={busy}>
              Save user
            </Button>
            <Button type="button" variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-primary">
            <tr>
              <th className="px-4 py-3 font-semibold">Access</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Sign-in</th>
              <th className="px-4 py-3 font-semibold">Menus</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users
              .filter(
                (user) =>
                  (roleFilter === "" || user.role === roleFilter) &&
                  textMatches(query, [user.name, user.identifier, user.role]),
              )
              .map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3">{roleProfiles[user.role].label}</td>
                  <td className="px-4 py-3 font-medium text-primary">{user.name}</td>
                  <td className="px-4 py-3">{user.identifier}</td>
                  <td className="px-4 py-3">
                    {user.menus === null || isPrincipalAdmin(user)
                      ? "All menus"
                      : `${user.menus.length} menus`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {user.role === "scholar" || user.role === "supervisor" ? (
                        <ProfilePhotoChange
                          role={user.role}
                          identifier={user.identifier}
                        />
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => beginEdit(user)}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy || isPrincipalAdmin(user)}
                        onClick={() => void remove(user)}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MenuPicker({
  role,
  selected,
  onToggle,
}: {
  role: (typeof accessRoles)[number];
  selected: readonly string[];
  onToggle: (href: string, checked: boolean) => void;
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-semibold text-primary">Menus</legend>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {portalGroups[role].map((group) => (
          <div key={group.heading}>
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {group.heading}
            </p>
            <ul className="mt-2 space-y-1">
              {group.items.map((item) => {
                const dashboard = item.href.endsWith("/dashboard");
                return (
                  <li key={item.href}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={dashboard || selected.includes(item.href)}
                        disabled={dashboard}
                        onChange={(event) => onToggle(item.href, event.target.checked)}
                      />
                      {item.label}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
