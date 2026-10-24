import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import { storeFolders } from "@/lib/file-ref";
import { createAdminSupabase } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ key: string[] }> };

const privateBucket = "portal-private";

/**
 * Opens a private file: only a signed-in ERP user is sent on, to a link that stops working
 * after two minutes. The address stored in a record stays the same.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await requestSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, message: "Sign in to open this file." },
      { status: 401 },
    );
  }
  const { key: parts } = await context.params;
  const valid =
    parts.length >= 2 &&
    parts.every(
      (part) => /^[A-Za-z0-9._-]+$/.test(part) && part !== "." && part !== "..",
    );
  const folder = parts[0] as keyof typeof storeFolders;
  if (!valid || storeFolders[folder] !== "private") {
    return NextResponse.json(
      { ok: false, message: "That file was not found." },
      { status: 404 },
    );
  }
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "File storage is not set up." },
      { status: 503 },
    );
  }
  const { data, error } = await supabase.storage
    .from(privateBucket)
    .createSignedUrl(parts.join("/"), 120);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { ok: false, message: "That file was not found." },
      { status: 404 },
    );
  }
  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, max-age=60");
  return response;
}
