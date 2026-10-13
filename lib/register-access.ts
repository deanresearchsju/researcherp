import { researchRegister } from "@/data/research-register";
import {
  insertPortalUsers,
  loadPortalUsers,
  publishPortalUsers,
  readStoredPortalUsers,
  seedUsers,
  writeStoredPortalUsers,
  type PortalUser,
  type UserLoad,
} from "@/lib/users";
import type { Role } from "@/types";

export const issuedPassword = "Welcome12345";

const resetColumnHint =
  "Run supabase/migrations/20261013220000_portal_user_password_reset.sql so every browser asks for a new password at the first sign-in.";

export type SignInDraft = {
  role: Role;
  name: string;
  identifier: string;
  password: string;
  mustReset: boolean;
};

export type ActivationReport = {
  created: number;
  alreadyActive: number;
  scholarsWithoutEmail: number;
  supervisorsWithoutEmail: number;
  load: UserLoad;
};

function hasMail(value: string) {
  return value.trim().includes("@");
}

function sameSignIn(user: PortalUser, role: Role, identifier: string) {
  return user.role === role && user.identifier.toLowerCase() === identifier.toLowerCase();
}

function toUser(row: SignInDraft): PortalUser {
  return {
    id: `local-${crypto.randomUUID()}`,
    role: row.role,
    name: row.name,
    identifier: row.identifier,
    password: row.password,
    mustReset: row.mustReset,
    menus: null,
  };
}

export async function activateRegisterAccounts(): Promise<ActivationReport> {
  const load = await loadPortalUsers();
  const scholars = researchRegister.scholars;
  const supervisors = researchRegister.supervisors;
  const scholarsWithMail = scholars.filter((scholar) => hasMail(scholar.email));
  const supervisorsWithMail = supervisors.filter((supervisor) =>
    hasMail(supervisor.email),
  );
  const scholarsWithoutEmail = scholars.length - scholarsWithMail.length;
  const supervisorsWithoutEmail = supervisors.length - supervisorsWithMail.length;
  function draftsFor(
    role: Role,
    people: readonly { name: string; email: string }[],
  ): SignInDraft[] {
    return people.flatMap((person) => {
      const identifier = person.email.trim();
      if (load.users.some((user) => sameSignIn(user, role, identifier))) return [];
      return [
        {
          role,
          name: person.name.trim() || identifier,
          identifier,
          password: issuedPassword,
          mustReset: true,
        },
      ];
    });
  }
  const scholarRows = draftsFor("scholar", scholarsWithMail);
  const supervisorRows = draftsFor("supervisor", supervisorsWithMail);
  const alreadyActive =
    scholarsWithMail.length -
    scholarRows.length +
    supervisorsWithMail.length -
    supervisorRows.length;
  const seedRows: SignInDraft[] =
    load.detail === "The user table is empty."
      ? seedUsers().map((user) => ({
          role: user.role,
          name: user.name,
          identifier: user.identifier,
          password: user.password,
          mustReset: false,
        }))
      : [];
  const newRows = [...scholarRows, ...supervisorRows];

  if (newRows.length === 0 && seedRows.length === 0) {
    return {
      created: 0,
      alreadyActive,
      scholarsWithoutEmail,
      supervisorsWithoutEmail,
      load,
    };
  }

  const saved = await insertPortalUsers([...seedRows, ...newRows]);
  if (saved.ok) {
    const reloaded = await loadPortalUsers();
    const next: UserLoad = saved.resetStoredLocally
      ? { ...reloaded, detail: resetColumnHint }
      : reloaded;
    publishPortalUsers(next);
    return {
      created: newRows.length,
      alreadyActive,
      scholarsWithoutEmail,
      supervisorsWithoutEmail,
      load: next,
    };
  }

  const missingTable = /relation|schema cache|not in the database/i.test(saved.message);
  if (!missingTable) {
    const reloaded = await loadPortalUsers();
    if (reloaded.source === "database") publishPortalUsers(reloaded);
    const present =
      scholarsWithMail.filter((scholar) =>
        reloaded.users.some((user) => sameSignIn(user, "scholar", scholar.email.trim())),
      ).length +
      supervisorsWithMail.filter((supervisor) =>
        reloaded.users.some((user) =>
          sameSignIn(user, "supervisor", supervisor.email.trim()),
        ),
      ).length;
    const createdNow = Math.max(0, present - alreadyActive);
    return {
      created: createdNow,
      alreadyActive: present - createdNow,
      scholarsWithoutEmail,
      supervisorsWithoutEmail,
      load:
        present < scholarsWithMail.length + supervisorsWithMail.length
          ? { ...reloaded, detail: saved.message }
          : reloaded,
    };
  }

  if (load.source === "database") {
    const reloaded = await loadPortalUsers();
    publishPortalUsers(reloaded);
    const stillMissing = newRows.filter(
      (row) => !reloaded.users.some((user) => sameSignIn(user, row.role, row.identifier)),
    );
    return {
      created: 0,
      alreadyActive: alreadyActive + (newRows.length - stillMissing.length),
      scholarsWithoutEmail,
      supervisorsWithoutEmail,
      load:
        stillMissing.length > 0
          ? {
              ...reloaded,
              detail: reloaded.detail ?? "Some sign-ins could not be created.",
            }
          : reloaded,
    };
  }

  const stored = readStoredPortalUsers();
  const nextUsers = [...stored];
  let created = 0;
  for (const row of newRows) {
    if (nextUsers.some((user) => sameSignIn(user, row.role, row.identifier))) continue;
    nextUsers.push(toUser(row));
    created += 1;
  }
  const next: UserLoad = {
    users: nextUsers,
    source: "browser",
    detail: "The user table is not in the database yet.",
  };
  writeStoredPortalUsers(nextUsers, next.detail);
  return {
    created,
    alreadyActive,
    scholarsWithoutEmail,
    supervisorsWithoutEmail,
    load: next,
  };
}
