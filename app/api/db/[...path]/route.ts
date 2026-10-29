import { NextResponse, type NextRequest } from "next/server";

import { requestSession } from "@/lib/api-session";
import { ensureRegisterSeed, scholarBySignIn } from "@/lib/register";
import { decideDbRequest, type DbActor } from "@/lib/db-policy";
import { projectRegisterRows } from "@/lib/db-projection";
import { clientAddress, rateLimit } from "@/lib/rate-limit";

/**
 * The only way the browser reaches the database. It looks at who is asking (the sign-in cookie),
 * asks lib/db-policy.ts whether that request is allowed, and then forwards it with the server's
 * own key, which never leaves the server. The public key of the database is not accepted here
 * and, once supabase/migrations/20261028100000_close_public_access.sql has run, no longer opens
 * any table either.
 */

/**
 * At most a few requests to the database are in flight at once: a page asks for a dozen things
 * together, and opening that many new connections at the same moment is what a poor network
 * path drops. The rest wait their turn and reuse the open connections.
 */
const maxInFlight = 4;
let inFlight = 0;
const waiting: (() => void)[] = [];
async function turn<T>(work: () => Promise<T>) {
  if (inFlight >= maxInFlight)
    await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
    waiting.shift()?.();
  }
}

const maxBodyBytes = 8 * 1024 * 1024;
const jsonHeaders = { "Cache-Control": "no-store" };

function fail(status: number, message: string, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { message },
    { status, headers: { ...jsonHeaders, ...headers } },
  );
}

/** A request that comes from another site (a forged form, a hostile page) is refused. */
function crossSite(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

function emptyAnswer(request: NextRequest) {
  const wantsOne = (request.headers.get("accept") ?? "").includes("vnd.pgrst.object");
  if (wantsOne) {
    return NextResponse.json(
      {
        code: "PGRST116",
        details: "The result contains 0 rows",
        hint: null,
        message: "Cannot coerce the result to a single JSON object",
      },
      { status: 406, headers: jsonHeaders },
    );
  }
  const headers = { ...jsonHeaders, "Content-Range": "*/0" };
  if (request.method === "HEAD") return new NextResponse(null, { status: 200, headers });
  return NextResponse.json([], { status: 200, headers });
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return fail(503, "The database is not set up.");

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD" && crossSite(request)) {
    return fail(403, "Not allowed.");
  }

  const session = await requestSession(request);
  const actor: DbActor = session
    ? { role: session.role, identifier: session.identifier }
    : null;
  if (actor && actor.role === "scholar") {
    // The scholar's own application numbers, so the scholar can open the application by number.
    await ensureRegisterSeed();
    const own = scholarBySignIn(actor.identifier);
    if (own) actor.applicationNumbers = [own.applicationNumber].filter(Boolean);
  }
  const address = clientAddress(request.headers);

  // Every visitor, signed in or not, is counted per address: a flood from one place is slowed.
  const flood = rateLimit(`db:ip:${address}`, session ? 4000 : 600, 60_000);
  if (!flood.allowed) {
    return fail(429, "Too many requests. Try again in a moment.", {
      "Retry-After": String(flood.retryAfterSeconds),
    });
  }

  let body: unknown;
  let bodyText: string | undefined;
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > maxBodyBytes) return fail(413, "That is too large.");
    bodyText = await request.text();
    if (bodyText.length > maxBodyBytes) return fail(413, "That is too large.");
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        return fail(400, "That is not valid.");
      }
    }
  }

  const { path } = await context.params;
  const decision = decideDbRequest(
    {
      method,
      path: path.join("/"),
      query: request.nextUrl.searchParams,
      prefer: (request.headers.get("prefer") ?? "").toLowerCase(),
      actor,
      body,
    },
    address,
  );

  if (decision.action === "deny") {
    console.warn(
      `[db] refused ${method} ${path.join("/")} for ${actor ? actor.role : "visitor"}: ${decision.message}`,
    );
    return fail(decision.status, decision.message);
  }
  if (decision.action === "empty") return emptyAnswer(request);

  const limited = rateLimit(
    decision.rate.key,
    decision.rate.limit,
    decision.rate.windowMs,
  );
  if (!limited.allowed) {
    return fail(429, "Too many requests. Try again in a little while.", {
      "Retry-After": String(limited.retryAfterSeconds),
    });
  }

  const headers = new Headers({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  });
  for (const name of ["accept", "content-type", "range", "range-unit"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value.slice(0, 200));
  }
  const prefer = request.headers.get("prefer");
  if (prefer) headers.set("Prefer", prefer.slice(0, 200));

  const query = decision.query.toString();
  const target = `${url.replace(/\/+$/, "")}/${path.join("/")}${query ? `?${query}` : ""}`;

  // A read that gets no answer is asked once more on a fresh connection (a slow or broken
  // connection to the database is usually gone the second time); a write is never repeated.
  const reading = method === "GET" || method === "HEAD";
  let upstream: Response | null = null;
  for (let attempt = 0; attempt < (reading ? 2 : 1) && !upstream; attempt += 1) {
    try {
      upstream = await turn(() =>
        fetch(target, {
          method,
          headers,
          body: bodyText ? bodyText : undefined,
          cache: "no-store",
          signal: AbortSignal.timeout(reading ? 12_000 : 30_000),
        }),
      );
    } catch (error) {
      if (attempt === (reading ? 1 : 0)) {
        console.error("[db] the database did not answer", error);
      }
    }
  }
  if (!upstream) return fail(502, "The database did not answer.");

  const out = new Headers(jsonHeaders);
  for (const name of [
    "content-type",
    "content-range",
    "preference-applied",
    "location",
  ]) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  if (decision.project === "register" && upstream.ok && method === "GET") {
    // The register shows a member only the contact details that member may see.
    const rows: unknown = await upstream.json().catch(() => null);
    if (rows === null) return fail(502, "The database did not answer.");
    out.set("content-type", "application/json");
    out.delete("content-range");
    return NextResponse.json(projectRegisterRows(rows, actor), {
      status: upstream.status,
      headers: out,
    });
  }
  const bodyless = method === "HEAD" || [204, 205, 304].includes(upstream.status);
  return new NextResponse(bodyless ? null : upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

export {
  handle as GET,
  handle as HEAD,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
