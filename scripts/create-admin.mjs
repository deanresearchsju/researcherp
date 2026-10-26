/**
 * Creates (or resets) the principal administrator sign-in: the account named "admin" that sees
 * every menu. Use it once when a new environment is set up, or if the administrator password is
 * lost. The password is stored hashed, exactly as the ERP stores it.
 *
 *   node --env-file=.env.local scripts/create-admin.mjs "Administrator" "a-long-new-password"
 *
 * The first sign-in asks for a new password. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY, and the migrations applied.
 */
import { randomBytes, scryptSync } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const [name = "Administrator", password = ""] = process.argv.slice(2);
if (password.length < 10) {
  console.error('Give a password of at least 10 characters: node scripts/create-admin.mjs "Name" "password"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const salt = randomBytes(16).toString("hex");
const hash = `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;

const { data: existing, error: readError } = await supabase
  .from("portal_users")
  .select("id")
  .eq("role", "admin")
  .ilike("identifier", "admin")
  .maybeSingle();
if (readError) {
  console.error(`Could not read the users: ${readError.message}`);
  process.exit(1);
}
const result = existing
  ? await supabase
      .from("portal_users")
      .update({ name, password: hash, must_reset: true })
      .eq("id", existing.id)
  : await supabase
      .from("portal_users")
      .insert({ role: "admin", identifier: "admin", name, password: hash, must_reset: true });
if (result.error) {
  console.error(`Could not save the administrator: ${result.error.message}`);
  process.exit(1);
}
console.log(
  `${existing ? "Updated" : "Created"} the administrator sign-in. Sign in at /login/admin as "admin"; a new password is asked for the first time.`,
);
