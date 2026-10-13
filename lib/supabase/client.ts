import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

export function createSupabase(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  if (typeof window === "undefined") {
    return createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  if (!browserClient) {
    browserClient = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return browserClient;
}
