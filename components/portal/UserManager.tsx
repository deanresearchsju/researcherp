"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { roleProfiles } from "@/data/roles";
import {
  updatePortalUser,
  userMigrationHint,
  type PortalUser,
  type UserLoad,
} from "@/lib/users";

const userFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the name."),
  password: z.string().min(6, "Password must be at least 6 characters.").max(128),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export function UserManager({ initial }: { initial: UserLoad }) {
  const [users, setUsers] = useState(initial.users);
  const [source] = useState(initial.source);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initial.detail);
  const [busy, setBusy] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: "", password: "" },
  });

  function beginEdit(user: PortalUser) {
    setEditingId(user.id);
    form.reset({ name: user.name, password: user.password });
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
    const saved = await updatePortalUser(current, values, source);
    setBusy(false);
    if (!saved.ok) {
      setNotice("That user could not be updated.");
      return;
    }
    setUsers((list) => list.map((user) => (user.id === current.id ? saved.user : user)));
    cancelEdit();
    setNotice(
      `Updated ${saved.user.name}. The new password is used at the next sign-in.`,
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        Admin
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">Users</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        {users.length} sign-in records. Reset a name or password here. The sign-in id
        stays the same.
      </p>
      {notice ? (
        <p role="status" className="mt-4 max-w-2xl text-sm leading-6 text-secondary">
          {notice} {source === "browser" && initial.detail ? userMigrationHint : ""}
        </p>
      ) : null}

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
            required
            error={form.formState.errors.password?.message}
          >
            <Input id="userPassword" {...form.register("password")} />
          </FormField>
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
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Sign-in</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border">
                <td className="px-4 py-3">{roleProfiles[user.role].label}</td>
                <td className="px-4 py-3 font-medium text-primary">{user.name}</td>
                <td className="px-4 py-3">{user.identifier}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => beginEdit(user)}
                  >
                    Reset
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
