import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { fetchWithTimeout } from "@/lib/supabase/timeout";
import type { Database } from "@/types/database";

export function createAdminSupabase(): SupabaseClient<Database> | null {
  if (typeof window !== "undefined") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}

export function portalAuthClient() {
  if (typeof window !== "undefined") return null;
  return createAdminSupabase();
}
