import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import { sniffFileType, storeFolders, type StoreFolder } from "@/lib/file-ref";
import { putS3, s3Enabled } from "@/lib/s3";
import { createAdminSupabase } from "@/lib/supabase/admin";

const maxBytes = 2 * 1024 * 1024;
const privateBucket = "portal-private";
const publicBucket = "portal-public";

/** Who may upload without signing in: the public application forms, a few files at a time. */
const anonymousFolders: readonly StoreFolder[] = ["applications"];
const windowMs = 10 * 60 * 1000;
const anonymousLimit = 40;
const visits = new Map<string, { count: number; resetAt: number }>();

function tooMany(request: NextRequest) {
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const seen = visits.get(address);
  if (!seen || seen.resetAt < now) {
    visits.set(address, { count: 1, resetAt: now + windowMs });
    return false;
  }
  seen.count += 1;
  return seen.count > anonymousLimit;
}

const fail = (message: string, status: number) =>
  NextResponse.json({ ok: false, message }, { status });

/** Stores one file (Amazon S3 when set up, otherwise Supabase Storage) and returns the reference to keep. */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("That file could not be read.", 400);
  }
  const folder = String(form.get("folder") ?? "") as StoreFolder;
  const file = form.get("file");
  if (!(folder in storeFolders)) return fail("That folder is not allowed.", 400);
  if (!(file instanceof File)) return fail("Choose a file to upload.", 400);

  const session = await requestSession(request);
  if (!session) {
    if (!anonymousFolders.includes(folder)) return fail("Sign in to upload.", 401);
    if (tooMany(request))
      return fail("Too many uploads. Try again in a few minutes.", 429);
  }
  if (file.size < 1 || file.size > maxBytes) {
    return fail("This file is outside the allowed size.", 400);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffFileType(bytes);
  if (!kind) return fail("Use a PDF, JPG or PNG file.", 400);

  const isPublic = storeFolders[folder] === "public";
  if (!isPublic && s3Enabled()) {
    const month = new Date().toISOString().slice(0, 7);
    const key = `${folder}/${month}/${crypto.randomUUID()}.${kind.ext}`;
    if (!(await putS3(key, bytes, kind.mime)))
      return fail("File storage is not ready.", 503);
    return NextResponse.json({ ok: true, ref: `/api/files/${key}` });
  }
  const supabase = createAdminSupabase();
  if (!supabase) return fail("File storage is not set up.", 503);
  const bucket = isPublic ? publicBucket : privateBucket;
  const month = new Date().toISOString().slice(0, 7);
  const key = `${folder}/${month}/${crypto.randomUUID()}.${kind.ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(key, bytes, { contentType: kind.mime, upsert: false });
  if (error) return fail("File storage is not ready.", 503);

  const ref = isPublic
    ? supabase.storage.from(bucket).getPublicUrl(key).data.publicUrl
    : `/api/files/${key}`;
  return NextResponse.json({ ok: true, ref });
}
