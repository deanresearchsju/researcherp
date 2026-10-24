"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { DeskModal, FormDialog, PageTitle } from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { ProfilePhotoChange } from "@/components/portal/ProfileCard";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { menuRightsCopy, officeWorkHrefs, portalGroups } from "@/data/portal";
import { roleNames } from "@/data/roles";
import {
  actionsForMenu,
  defaultMenuHrefs,
  isOfficeRole,
  isPrincipalAdmin,
  menuActionCopy,
  menuActionKey,
  menuHrefs,
  menuLabels,
  parseMenuActionKey,
  storedMenus,
  type MenuActionKind,
} from "@/lib/access";
import { activateRegisterAccounts, type ActivationReport } from "@/lib/register-access";
import { cn } from "@/lib/utils";
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

const accessRoles = [
  "scholar",
  "supervisor",
  "admin",
  "staff",
  "dean",
  "accounts",
  "vc",
  "coe",
  "coeverify",
] as const;

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
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [roleTab, setRoleTab] = useState<"all" | (typeof accessRoles)[number]>("all");
  const [rightsOf, setRightsOf] = useState<PortalUser | null>(null);

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
  const [selectedMenus, setSelectedMenus] = useState<string[]>(
    defaultMenuHrefs("scholar"),
  );
  const [editMenus, setEditMenus] = useState<string[]>([]);
  const [issued, setIssued] = useState<ActivationReport["issued"]>([]);
  const editingUser = users.find((user) => user.id === editingId) ?? null;
  if (createRole !== menuRole) {
    setMenuRole(createRole);
    setSelectedMenus(defaultMenuHrefs(createRole));
  }

  function toggleMenu(current: string[], href: string, checked: boolean) {
    if (href.endsWith("/dashboard")) return current;
    if (checked) return current.includes(href) ? current : [...current, href];
    return current.filter((item) => item !== href && !item.startsWith(`${href}#`));
  }

  function toggleGroup(current: string[], hrefs: readonly string[], checked: boolean) {
    const extra = hrefs.filter((href) => !href.endsWith("/dashboard"));
    const without = current.filter(
      (item) =>
        !extra.includes(item) && extra.every((href) => !item.startsWith(`${href}#`)),
    );
    return checked ? [...without, ...extra] : without;
  }

  function toggleAction(
    current: string[],
    href: string,
    action: MenuActionKind,
    checked: boolean,
  ) {
    const key = menuActionKey(href, action);
    if (checked) {
      const withPage =
        href.endsWith("/dashboard") || current.includes(href)
          ? current
          : [...current, href];
      return withPage.includes(key) ? withPage : [...withPage, key];
    }
    return current.filter((item) => item !== key);
  }

  function beginEdit(user: PortalUser) {
    setEditingId(user.id);
    form.reset({ name: user.name, password: "" });
    setEditMenus(user.menus ?? defaultMenuHrefs(user.role));
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
    setCreating(false);
    setNotice(
      `${saved.user.name} can sign in as ${roleNames[saved.user.role]} with ${saved.user.identifier}. They choose a new password the first time they sign in.`,
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

  const listed = users.filter(
    (user) =>
      (roleTab === "all" || user.role === roleTab) &&
      textMatches(query, [user.name, user.identifier, user.role]),
  );

  return (
    <div>
      <PageTitle
        kicker="Administration"
        title="Users"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void activateScholars()}
            >
              Activate register sign-in
            </Button>
            <Button
              type="button"
              variant="gold"
              onClick={() => {
                setNotice(null);
                setCreating(true);
              }}
            >
              Create user
            </Button>
          </>
        }
      />
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

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Access">
        {(["all", ...tabOrder] as const).map((tab) => {
          const count =
            tab === "all"
              ? users.length
              : users.filter((user) => user.role === tab).length;
          const active = roleTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              data-readonly-allow
              onClick={() => setRoleTab(tab)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary",
              )}
            >
              {tab === "all" ? "All users" : tabLabels[tab]}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-xs",
                  active ? "bg-card/20" : "bg-muted text-primary",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={listed.length}
        total={users.length}
        filename="users.csv"
        title={`Users · ${roleTab === "all" ? "all" : tabLabels[roleTab]}`}
        headers={["Access", "Name", "Sign-in", "Rights"]}
        rows={listed.map((user) => [
          roleNames[user.role],
          user.name,
          user.identifier,
          rightsSummary(user),
        ])}
      />

      {creating ? (
        <FormDialog
          title="Create user"
          onClose={() => setCreating(false)}
          onSubmit={createForm.handleSubmit(onCreate)}
          busy={busy}
          submitLabel="Give access"
          size="lg"
        >
          {notice ? (
            <p role="alert" className="text-sm text-secondary">
              {notice}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Access"
              htmlFor="createRole"
              required
              error={createForm.formState.errors.role?.message}
            >
              <NativeSelect id="createRole" {...createForm.register("role")}>
                {accessRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleNames[role]}
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
              onToggleGroup={(hrefs, checked) =>
                setSelectedMenus((current) => toggleGroup(current, hrefs, checked))
              }
              onToggleAction={(href, action, checked) =>
                setSelectedMenus((current) =>
                  toggleAction(current, href, action, checked),
                )
              }
              onSelectAll={() => setSelectedMenus(menuHrefs(createRole))}
              onClear={() =>
                setSelectedMenus(
                  menuHrefs(createRole).filter((href) => href.endsWith("/dashboard")),
                )
              }
            />
          </div>
        </FormDialog>
      ) : null}

      {editingUser ? (
        <FormDialog
          title={`Edit · ${editingUser.name}`}
          onClose={cancelEdit}
          onSubmit={form.handleSubmit(onSubmit)}
          busy={busy}
          submitLabel="Save user"
          size="lg"
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
            {!isPrincipalAdmin(editingUser) ? (
              <MenuPicker
                role={editingUser.role}
                selected={editMenus}
                onToggle={(href, checked) =>
                  setEditMenus((current) => toggleMenu(current, href, checked))
                }
                onToggleGroup={(hrefs, checked) =>
                  setEditMenus((current) => toggleGroup(current, hrefs, checked))
                }
                onToggleAction={(href, action, checked) =>
                  setEditMenus((current) => toggleAction(current, href, action, checked))
                }
                onSelectAll={() => setEditMenus(menuHrefs(editingUser.role))}
                onClear={() =>
                  setEditMenus(
                    menuHrefs(editingUser.role).filter((href) =>
                      href.endsWith("/dashboard"),
                    ),
                  )
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                This sign-in keeps every menu.
              </p>
            )}
          </div>
        </FormDialog>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="bg-muted text-xs tracking-wide text-primary uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Access</th>
              <th className="px-4 py-3 font-semibold">Rights</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {listed.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No user matches.
                </td>
              </tr>
            ) : (
              listed.map((user) => (
                <tr key={user.id} className="border-t border-border align-middle">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-primary">
                      {user.role === "scholar" || user.role === "supervisor" ? (
                        <PersonNameLink
                          role={user.role}
                          name={user.name}
                          identifier={user.identifier}
                        />
                      ) : (
                        user.name
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.identifier}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={isOfficeRole(user.role) ? "purple" : "outline"}>
                      {roleNames[user.role]}
                    </Badge>
                    {user.mustReset ? (
                      <p className="mt-1 text-xs text-secondary">
                        Must set a new password
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {isPrincipalAdmin(user) ? (
                      <Badge variant="gold">Full access</Badge>
                    ) : (
                      <button
                        type="button"
                        data-readonly-allow
                        className="text-left text-xs text-muted-foreground hover:text-primary"
                        onClick={() => setRightsOf(user)}
                      >
                        <span className="font-semibold text-primary">
                          {rightsSummary(user)}
                        </span>
                        <span className="ml-1 underline-offset-2 hover:underline">
                          View
                        </span>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
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
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          beginEdit(user);
                        }}
                      >
                        Edit
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {rightsOf ? (
        <DeskModal
          title={`Rights · ${rightsOf.name}`}
          onClose={() => setRightsOf(null)}
          size="md"
        >
          <RightsView user={rightsOf} />
        </DeskModal>
      ) : null}
    </div>
  );
}

const tabOrder = [
  "scholar",
  "supervisor",
  "staff",
  "dean",
  "accounts",
  "vc",
  "coe",
  "coeverify",
  "admin",
] as const;
const tabLabels: Record<(typeof tabOrder)[number], string> = {
  scholar: "Scholars",
  supervisor: "Supervisors",
  staff: "Staff",
  dean: "Dean",
  accounts: "Accounts",
  vc: "Vice Chancellor",
  coe: "COE · Marks entry",
  coeverify: "COE · Verification",
  admin: "Administrators",
};

/** "12 menus · 30 rights" style summary for the users table. */
function rightsSummary(user: PortalUser) {
  if (isPrincipalAdmin(user)) return "Full access";
  const menus = user.menus ?? defaultMenuHrefs(user.role);
  const pages = menus.filter(
    (item) => !item.includes("#") && !item.endsWith("/dashboard"),
  );
  const actions = menus.filter((item) => parseMenuActionKey(item) !== null);
  if (pages.length === 0) return "Dashboard only";
  if (!isOfficeRole(user.role)) return `${pages.length} menus`;
  return `${pages.length} menus · ${actions.length} rights`;
}

function RightsView({ user }: { user: PortalUser }) {
  const labels = menuLabels(user.role, user.menus ?? defaultMenuHrefs(user.role)) ?? [];
  const pages = labels.filter((label) => !label.includes(" · "));
  return (
    <div className="space-y-3">
      {pages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{menuRightsCopy.dashboardOnly}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pages.map((page) => {
            const actions = labels
              .filter((label) => label.startsWith(`${page} · `))
              .map((label) => label.slice(page.length + 3));
            return (
              <li
                key={page}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <p className="font-semibold text-primary">{page}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {actions.length ? actions.join(" · ") : "Open only"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MenuPicker({
  role,
  selected,
  onToggle,
  onToggleGroup,
  onToggleAction,
  onSelectAll,
  onClear,
}: {
  role: (typeof accessRoles)[number];
  selected: readonly string[];
  onToggle: (href: string, checked: boolean) => void;
  onToggleGroup: (hrefs: readonly string[], checked: boolean) => void;
  onToggleAction: (href: string, action: MenuActionKind, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const office = isOfficeRole(role);
  const columns: MenuActionKind[] = office ? ["edit", "approve", "export", "upload"] : [];

  function grantColumn(
    hrefs: readonly string[],
    action: MenuActionKind,
    checked: boolean,
  ) {
    for (const href of hrefs) {
      if (actionsForMenu(href, role).includes(action))
        onToggleAction(href, action, checked);
    }
  }

  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-semibold text-primary">
        {menuRightsCopy.title} · {roleNames[role]}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onSelectAll}>
          {office ? "Open every menu" : menuRightsCopy.selectAll}
        </Button>
        {office ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const hrefs = menuHrefs(role).filter(
                (href) => !href.endsWith("/dashboard"),
              );
              onToggleGroup(hrefs, true);
              for (const action of columns) grantColumn(hrefs, action, true);
            }}
          >
            Full rights on every menu
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={onClear}>
          {menuRightsCopy.clear}
        </Button>
        {office ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onToggleGroup(officeWorkHrefs, true)}
          >
            {menuRightsCopy.grantWork}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs text-primary">
            <tr>
              <th className="px-3 py-2 font-semibold">Menu</th>
              <th className="w-16 px-2 py-2 text-center font-semibold">Open</th>
              {columns.map((action) => (
                <th key={action} className="w-24 px-2 py-2 text-center font-semibold">
                  {menuActionCopy[action]}
                </th>
              ))}
            </tr>
          </thead>
          {portalGroups[role].map((group) => {
            const extra = group.items.filter((item) => !item.href.endsWith("/dashboard"));
            const hrefs = extra.map((item) => item.href);
            const groupOn =
              extra.length > 0 && hrefs.every((href) => selected.includes(href));
            return (
              <tbody
                key={group.heading || group.items[0]?.href}
                className="border-t border-border"
              >
                {group.heading && extra.length > 0 ? (
                  <tr className="bg-muted/40">
                    <th className="px-3 py-1.5 text-[0.68rem] font-bold tracking-[0.14em] text-secondary uppercase">
                      {group.heading}
                    </th>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Open every ${group.heading} menu`}
                        checked={groupOn}
                        onChange={(event) => onToggleGroup(hrefs, event.target.checked)}
                      />
                    </td>
                    {columns.map((action) => {
                      const able = hrefs.filter((href) =>
                        actionsForMenu(href, role).includes(action),
                      );
                      const on =
                        able.length > 0 &&
                        able.every((href) =>
                          selected.includes(menuActionKey(href, action)),
                        );
                      return (
                        <td key={action} className="px-2 py-1.5 text-center">
                          {able.length > 0 ? (
                            <input
                              type="checkbox"
                              aria-label={`${menuActionCopy[action]} on every ${group.heading} menu`}
                              checked={on}
                              onChange={(event) =>
                                grantColumn(able, action, event.target.checked)
                              }
                            />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ) : null}
                {group.items.map((item) => {
                  const dashboard = item.href.endsWith("/dashboard");
                  const pageOn = dashboard || selected.includes(item.href);
                  const available = actionsForMenu(item.href, role);
                  return (
                    <tr key={item.href} className="border-t border-border/60">
                      <td className="px-3 py-1.5 pl-5">{item.label}</td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Open ${item.label}`}
                          checked={pageOn}
                          disabled={dashboard}
                          onChange={(event) => onToggle(item.href, event.target.checked)}
                        />
                      </td>
                      {columns.map((action) => (
                        <td key={action} className="px-2 py-1.5 text-center">
                          {available.includes(action) ? (
                            <input
                              type="checkbox"
                              aria-label={`${menuActionCopy[action]} · ${item.label}`}
                              checked={selected.includes(
                                menuActionKey(item.href, action),
                              )}
                              onChange={(event) =>
                                onToggleAction(item.href, action, event.target.checked)
                              }
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
    </fieldset>
  );
}
