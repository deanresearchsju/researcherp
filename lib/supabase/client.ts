import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { fetchWithTimeout } from "@/lib/supabase/timeout";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

/**
 * The database client. In the browser it talks to this site's own /api/db, which checks who is
 * asking and forwards allowed requests with the server's key; the browser holds no database key.
 * On the server (pages and API routes, which check the sign-in themselves) it uses the server's
 * key directly.
 */
export function createSupabase(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  if (typeof window === "undefined") {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!key) return null;
    return createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout },
    });
  }

  if (!browserClient) {
    // The key below is only a placeholder the client library insists on; /api/db ignores it.
    browserClient = createClient<Database>(
      `${window.location.origin}/api/db`,
      "browser",
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchWithTimeout },
      },
    );
  }
  return browserClient;
}
