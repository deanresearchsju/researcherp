import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canMenuAction, isOfficeRole } from "@/lib/access";
import { requestSession } from "@/lib/api-session";
import {
  formCategories,
  formFileType,
  formMaxBytes,
  parseAudience,
  type FormAudience,
  type PortalForm,
} from "@/lib/portal-forms";
import type { CookieSession } from "@/lib/session";
import { createAdminSupabase } from "@/lib/supabase/admin";

const migrationHint =
  "Forms are not set up yet. Run supabase/migrations/20261022100000_portal_forms.sql in the Supabase SQL editor.";
const formsHref = "/admin/forms";
const listColumns =
  "id, title, category, audience, file_name, file_type, file_size, complete, uploaded_by, created_at, updated_at";

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

/** Which audiences this reader may see; office sign-ins see every form. */
function readerAudiences(session: CookieSession | null): FormAudience[] | null {
  if (!session) return ["public"];
  if (isOfficeRole(session.role)) return null;
  if (session.role === "scholar") return ["scholar", "public"];
  if (session.role === "supervisor") return ["supervisor", "public"];
  return ["public"];
}

function mayRead(audience: readonly string[], allowed: FormAudience[] | null) {
  return (
    allowed === null || audience.some((item) => (allowed as string[]).includes(item))
  );
}

type ListRow = {
  id: string;
  title: string;
  category: string;
  audience: string[];
  file_name: string;
  file_type: string;
  file_size: number;
  complete: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

function toForm(row: ListRow): PortalForm {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    audience: parseAudience(row.audience),
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    complete: row.complete,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contentDisposition(fileName: string, inline: boolean) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: NextRequest) {
  const session = await requestSession(request);
  const allowed = readerAudiences(session);
  const supabase = createAdminSupabase();
  if (!supabase) return fail(migrationHint, 503);

  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const { data, error } = await supabase
      .from("portal_forms")
      .select("title, audience, file_name, file_type, file_data, complete")
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(migrationHint, 503);
    if (!data || !data.complete || !mayRead(data.audience, allowed)) {
      return fail("That form is not available.", 404);
    }
    const comma = data.file_data.indexOf(",");
    const bytes = Buffer.from(
      comma >= 0 ? data.file_data.slice(comma + 1) : data.file_data,
      "base64",
    );
    const inline =
      request.nextUrl.searchParams.get("view") === "1" &&
      data.file_type === "application/pdf";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": data.file_type,
        "Content-Length": String(bytes.length),
        "Content-Disposition": contentDisposition(data.file_name, inline),
        "Cache-Control": "private, no-store",
      },
    });
  }

  const { data, error } = await supabase
    .from("portal_forms")
    .select(listColumns)
    .order("category")
    .order("title");
  if (error) return fail(migrationHint, 503);
  const forms = (data as ListRow[])
    .filter((row) => (row.complete || allowed === null) && mayRead(row.audience, allowed))
    .map(toForm);
  return NextResponse.json({ ok: true, forms });
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const session = await requestSession(request);
  if (!session || !isOfficeRole(session.role)) {
    return fail("Only the research office can change forms.", 403);
  }
  if (!canMenuAction(session, formsHref, "edit")) {
    return fail(
      "Your sign-in is not permitted to add or edit forms. Ask the administrator.",
      403,
    );
  }
  const supabase = createAdminSupabase();
  if (!supabase) return fail(migrationHint, 503);

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return fail("That request was not valid.");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("That file is too large or the request was not valid.");
  }

  const id = text(body.id, 64);
  if (body.action === "delete") {
    if (session.role !== "admin")
      return fail("Only the administrator can remove a form.", 403);
    if (!id) return fail("Choose a form to remove.");
    const { error } = await supabase.from("portal_forms").delete().eq("id", id);
    if (error) return fail("That form could not be removed.", 500);
    return NextResponse.json({ ok: true, message: "Form removed." });
  }
  if (body.action === "append") {
    // The next part of a large file; the last part completes the form.
    const part = typeof body.data === "string" ? body.data : "";
    if (!id || !part || !/^[A-Za-z0-9+/=]+$/.test(part))
      return fail("That part could not be read.");
    const { data: row, error } = await supabase
      .from("portal_forms")
      .select("file_data, complete, title")
      .eq("id", id)
      .maybeSingle();
    if (error || !row)
      return fail("That upload was not found. Upload the file again.", 404);
    if (row.complete) return fail("That upload is already complete.");
    const fileData = row.file_data + part;
    const last = body.last === true;
    const size = Math.floor(((fileData.length - fileData.indexOf(",") - 1) * 3) / 4);
    if (size > formMaxBytes) return fail("That file is larger than 10 MB.");
    const { error: saveError } = await supabase
      .from("portal_forms")
      .update({
        file_data: fileData,
        ...(last
          ? { complete: true, file_size: size, updated_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", id);
    if (saveError)
      return fail("That part could not be saved. Upload the file again.", 500);
    return NextResponse.json({ ok: true, message: last ? `${row.title} uploaded.` : "" });
  }
  if (body.action !== "save") return fail("That request was not valid.");

  const title = text(body.title, 160);
  if (title.length < 3) return fail("Enter the form title.");
  const category = (formCategories as readonly string[]).includes(text(body.category, 60))
    ? text(body.category, 60)
    : "General";
  const audience = parseAudience(body.audience);
  if (audience.length === 0) return fail("Choose who can download this form.");

  const fileName = text(body.fileName, 200);
  const fileData = typeof body.fileData === "string" ? body.fileData : "";
  // More parts follow when the file is too large for one request.
  const morePartsFollow = body.moreParts === true;
  let file: {
    file_name: string;
    file_type: string;
    file_size: number;
    file_data: string;
    complete: boolean;
  } | null = null;
  if (fileName || fileData) {
    const fileType = formFileType(fileName);
    if (!fileType) return fail("Upload a Word (.doc, .docx) or PDF file.");
    const comma = fileData.indexOf(",");
    if (!fileData.startsWith("data:") || comma < 0)
      return fail("That file could not be read.");
    const declared = Number(body.fileSize);
    const size = morePartsFollow
      ? Number.isFinite(declared)
        ? Math.floor(declared)
        : 0
      : Math.floor(((fileData.length - comma - 1) * 3) / 4);
    if (size <= 0) return fail("That file is empty.");
    if (size > formMaxBytes) return fail("That file is larger than 10 MB.");
    file = {
      file_name: fileName,
      file_type: fileType,
      file_size: size,
      file_data: `data:${fileType};base64,${fileData.slice(comma + 1)}`,
      complete: !morePartsFollow,
    };
  }

  const uploadedBy = session.name.trim() || session.identifier;
  const now = new Date().toISOString();
  if (id) {
    const { error } = await supabase
      .from("portal_forms")
      .update({
        title,
        category,
        audience,
        uploaded_by: uploadedBy,
        updated_at: now,
        ...(file ?? {}),
      })
      .eq("id", id);
    if (error) return fail("That form could not be saved.", 500);
    return NextResponse.json({ ok: true, id, message: `${title} updated.` });
  }
  if (!file) return fail("Choose the Word or PDF file to upload.");
  const { data: inserted, error } = await supabase
    .from("portal_forms")
    .insert({ title, category, audience, uploaded_by: uploadedBy, ...file })
    .select("id")
    .single();
  if (error || !inserted) {
    return fail(
      error?.code === "42P01" ? migrationHint : "That form could not be saved.",
      500,
    );
  }
  return NextResponse.json({ ok: true, id: inserted.id, message: `${title} uploaded.` });
}
