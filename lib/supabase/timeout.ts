/** Longest a database request may take before the page shows its fallback. */
const requestTimeoutMs = 30_000;

/**
 * fetch with a time limit, so an unreachable database fails the request instead of leaving a
 * page waiting forever. A caller's own abort signal still works.
 */
export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(requestTimeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}
