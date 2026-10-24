import { parseMenuRights } from "@/lib/access";
import { hashSecret } from "@/lib/passwords";
import { createAdminSupabase, portalAuthClient } from "@/lib/supabase/admin";
import { isRetiredSignIn, type PortalUser } from "@/lib/users";
import { ROLES, type Role } from "@/types";

type UserRow = {
  id: string;
  role: string;
  name: string;
  identifier: string;
  must_reset?: boolean | null;
  menu_rights?: unknown;
};

function missingMenuColumn(message: string) {
  return /menu_rights/i.test(message);
}

function missingResetColumn(message: string) {
  return /must_reset/i.test(message);
}

function mapPublicUser(row: UserRow): PortalUser | null {
  const role = row.role;
  if (!(ROLES as readonly string[]).includes(role)) return null;
  return {
    id: row.id,
    role: role as Role,
    name: row.name,
    identifier: row.identifier,
    password: "",
    mustReset: row.must_reset === true,
    menus: parseMenuRights(row.menu_rights),
  };
}

export async function listPortalUsers() {
  const supabase = portalAuthClient();
  if (!supabase) {
    return { ok: false as const, message: "The user table is not available." };
  }
  const full = await supabase
    .from("portal_users")
    .select("id, role, name, identifier, must_reset, menu_rights")
    .order("role")
    .order("name");
  const fallback =
    full.error && missingMenuColumn(full.error.message)
      ? await supabase
          .from("portal_users")
          .select("id, role, name, identifier, must_reset")
          .order("role")
          .order("name")
      : null;
  const chosen = fallback ?? full;
  const last =
    chosen.error && missingResetColumn(chosen.error.message)
      ? await supabase
          .from("portal_users")
          .select("id, role, name, identifier")
          .order("role")
          .order("name")
      : null;
  const data = last?.data ?? chosen.data;
  const error = last ? last.error : chosen.error;
  if (error || !data) {
    return {
      ok: false as const,
      message: error?.message ?? "Users could not be loaded.",
    };
  }
  return {
    ok: true as const,
    users: data.flatMap((row) => {
      const user = mapPublicUser(row);
      return user && !isRetiredSignIn(user) ? [user] : [];
    }),
  };
}

export async function insertPortalUserRows(
  rows: {
    role: Role;
    name: string;
    identifier: string;
    password: string;
    mustReset: boolean;
  }[],
) {
  const supabase = createAdminSupabase() ?? portalAuthClient();
  if (!supabase) {
    return { ok: false as const, message: "The user table is not in the database yet." };
  }
  if (rows.length === 0) return { ok: true as const, users: [] as PortalUser[] };

  const payload = rows.map((row) => ({
    role: row.role,
    name: row.name,
    identifier: row.identifier,
    password: hashSecret(row.password),
    must_reset: row.mustReset,
  }));

  const inserted = await supabase
    .from("portal_users")
    .insert(payload)
    .select("id, role, name, identifier, must_reset, menu_rights");

  if (inserted.error && missingMenuColumn(inserted.error.message)) {
    const retry = await supabase
      .from("portal_users")
      .insert(payload)
      .select("id, role, name, identifier, must_reset");
    if (retry.error && missingResetColumn(retry.error.message)) {
      const plain = await supabase
        .from("portal_users")
        .insert(
          payload.map((row) => ({
            role: row.role,
            name: row.name,
            identifier: row.identifier,
            password: row.password,
          })),
        )
        .select("id, role, name, identifier");
      if (plain.error || !plain.data) {
        return {
          ok: false as const,
          message: plain.error?.message ?? "Those sign-ins could not be created.",
        };
      }
      return {
        ok: true as const,
        users: plain.data.flatMap((row) => {
          const user = mapPublicUser({ ...row, must_reset: true });
          return user ? [user] : [];
        }),
      };
    }
    if (retry.error || !retry.data) {
      return {
        ok: false as const,
        message: retry.error?.message ?? "Those sign-ins could not be created.",
      };
    }
    return {
      ok: true as const,
      users: retry.data.flatMap((row) => {
        const user = mapPublicUser(row);
        return user ? [user] : [];
      }),
    };
  }

  if (inserted.error || !inserted.data) {
    return {
      ok: false as const,
      message: inserted.error?.message ?? "Those sign-ins could not be created.",
    };
  }

  return {
    ok: true as const,
    users: inserted.data.flatMap((row) => {
      const user = mapPublicUser(row);
      return user ? [user] : [];
    }),
  };
}

export async function createPortalUserRow(input: {
  role: Role;
  name: string;
  identifier: string;
  password: string;
  menus: string[] | null;
}) {
  const supabase = createAdminSupabase() ?? portalAuthClient();
  if (!supabase) {
    return { ok: false as const, message: "That user could not be created." };
  }
  const password = hashSecret(input.password);
  const inserted = await supabase
    .from("portal_users")
    .insert({
      role: input.role,
      name: input.name,
      identifier: input.identifier,
      password,
      must_reset: true,
      menu_rights: input.menus,
    })
    .select("id, role, name, identifier, must_reset, menu_rights")
    .single();
  const withoutMenus =
    inserted.error && missingMenuColumn(inserted.error.message)
      ? await supabase
          .from("portal_users")
          .insert({
            role: input.role,
            name: input.name,
            identifier: input.identifier,
            password,
            must_reset: true,
          })
          .select("id, role, name, identifier, must_reset")
          .single()
      : null;
  const chosen = withoutMenus ?? inserted;
  const fallback =
    chosen.error && missingResetColumn(chosen.error.message)
      ? await supabase
          .from("portal_users")
          .insert({
            role: input.role,
            name: input.name,
            identifier: input.identifier,
            password,
          })
          .select("id, role, name, identifier")
          .single()
      : null;
  const data = fallback ? fallback.data : chosen.data;
  const error = fallback ? fallback.error : chosen.error;
  const user = data
    ? mapPublicUser({ ...data, must_reset: true, menu_rights: input.menus })
    : null;
  if (error || !user) {
    // The database may not yet accept the Accounts / Vice Chancellor / Staff / Dean types.
    if (error && /role_check|check constraint/i.test(error.message)) {
      return {
        ok: false as const,
        message:
          "The database does not accept this sign-in type yet. Run supabase/migrations/20261023100000_office_roles.sql in the Supabase SQL editor, then try again.",
      };
    }
    if (error && /duplicate|unique/i.test(error.message)) {
      return {
        ok: false as const,
        message: "That sign-in id already exists for this access type.",
      };
    }
    return { ok: false as const, message: "That user could not be created." };
  }
  return { ok: true as const, user };
}

export async function updatePortalUserRow(
  id: string,
  next: { name: string; password: string; mustReset: boolean; menus: string[] | null },
) {
  const supabase = createAdminSupabase() ?? portalAuthClient();
  if (!supabase) return { ok: false as const, message: "That user could not be saved." };
  const fields: {
    name: string;
    must_reset: boolean;
    menu_rights: string[] | null;
    password?: string;
  } = {
    name: next.name.trim(),
    must_reset: next.mustReset,
    menu_rights: next.menus,
  };
  if (next.password.trim()) fields.password = hashSecret(next.password.trim());
  const saved = await supabase.from("portal_users").update(fields).eq("id", id);
  if (saved.error && missingMenuColumn(saved.error.message)) {
    const retryFields: { name: string; must_reset: boolean; password?: string } = {
      name: fields.name,
      must_reset: fields.must_reset,
    };
    if (fields.password) retryFields.password = fields.password;
    const retry = await supabase.from("portal_users").update(retryFields).eq("id", id);
    if (retry.error && missingResetColumn(retry.error.message)) {
      const plainFields: { name: string; password?: string } = { name: fields.name };
      if (fields.password) plainFields.password = fields.password;
      const plain = await supabase.from("portal_users").update(plainFields).eq("id", id);
      if (plain.error) {
        return { ok: false as const, message: "That user could not be saved." };
      }
    } else if (retry.error) {
      return { ok: false as const, message: "That user could not be saved." };
    }
  } else if (saved.error && missingResetColumn(saved.error.message)) {
    const retryFields: { name: string; menu_rights: string[] | null; password?: string } =
      {
        name: fields.name,
        menu_rights: fields.menu_rights,
      };
    if (fields.password) retryFields.password = fields.password;
    const retry = await supabase.from("portal_users").update(retryFields).eq("id", id);
    if (retry.error) {
      return { ok: false as const, message: "That user could not be saved." };
    }
  } else if (saved.error) {
    return { ok: false as const, message: "That user could not be saved." };
  }
  const listed = await listPortalUsers();
  const user = listed.ok ? listed.users.find((item) => item.id === id) : undefined;
  if (!user) return { ok: false as const, message: "That user could not be saved." };
  return { ok: true as const, user };
}

export async function deletePortalUserRow(id: string) {
  const supabase = createAdminSupabase() ?? portalAuthClient();
  if (!supabase) return { ok: false as const };
  const { error } = await supabase.from("portal_users").delete().eq("id", id);
  if (error) return { ok: false as const };
  return { ok: true as const };
}
