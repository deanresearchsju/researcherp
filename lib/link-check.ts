import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Checks, from the server, that a DOI is registered and that a web link opens. A DOI is asked of
 * doi.org only. A web link is fetched with care: http or https on the usual ports, every address
 * the name points to must be a public one (never this server, the local network or the cloud's
 * internal addresses), redirects are followed by hand and checked again, and nothing of the page
 * is read beyond the reply line.
 */
export type LinkCheck = { status: "ok" | "missing" | "unknown"; message: string };

const timeoutMs = 6000;

function cleanDoi(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
}

export async function checkDoi(value: string): Promise<LinkCheck> {
  const doi = cleanDoi(value);
  if (!/^10\.\d{4,9}\/\S+$/.test(doi))
    return { status: "missing", message: "Enter a DOI such as 10.1000/xyz123." };
  try {
    const response = await fetch(
      `https://doi.org/api/handles/${encodeURIComponent(doi).replace(/%2F/g, "/")}`,
      { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } },
    );
    if (response.status === 404)
      return { status: "missing", message: "This DOI is not registered at doi.org." };
    const data = (await response.json().catch(() => null)) as {
      responseCode?: number;
    } | null;
    if (data?.responseCode === 1)
      return { status: "ok", message: "DOI found at doi.org." };
    if (data?.responseCode === 100)
      return { status: "missing", message: "This DOI is not registered at doi.org." };
    return { status: "unknown", message: "doi.org could not confirm the DOI now." };
  } catch {
    return { status: "unknown", message: "doi.org could not be reached now." };
  }
}

/** Addresses a link must never lead the server to. */
export function isPrivateAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

async function safeTarget(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "Enter a full link (https://…)." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { error: "Only http and https links are accepted." };
  if (url.username || url.password)
    return { error: "Remove the user name from the link." };
  if (url.port && url.port !== "80" && url.port !== "443")
    return { error: "Use a link on the usual web port." };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host))
      return { error: "This link points to a private address." };
    return { url };
  }
  if (
    !host.includes(".") ||
    /\.(local|internal|localhost)$/i.test(host) ||
    host === "localhost"
  )
    return { error: "This link points to a private address." };
  try {
    const addresses = await lookup(host, { all: true });
    if (
      addresses.length === 0 ||
      addresses.some((item) => isPrivateAddress(item.address))
    )
      return { error: "This link points to a private address." };
  } catch {
    return { missing: true, error: "This web address does not exist." };
  }
  return { url };
}

export async function checkLink(raw: string): Promise<LinkCheck> {
  let current = raw.trim();
  for (let hop = 0; hop < 4; hop += 1) {
    const target = await safeTarget(current);
    if (!target.url)
      return {
        status: "missing",
        message: target.error ?? "The link could not be opened.",
      };
    let response: Response;
    try {
      response = await fetch(target.url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": "SJU-Research-ERP link check", Accept: "text/html,*/*" },
      });
      // Only the reply line is needed; the page itself is never read.
      void response.body?.cancel().catch(() => undefined);
    } catch {
      return { status: "unknown", message: "The site did not answer in time." };
    }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next)
        return { status: "unknown", message: "The site sent an empty redirect." };
      current = new URL(next, target.url).toString();
      continue;
    }
    if (response.status === 404 || response.status === 410)
      return { status: "missing", message: "The page was not found at this link." };
    // Many journal sites refuse automated visits (401, 403, 429) although the page exists.
    return { status: "ok", message: "The link opens." };
  }
  return { status: "unknown", message: "The link redirects too many times." };
}
