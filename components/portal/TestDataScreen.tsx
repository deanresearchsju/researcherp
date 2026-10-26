"use client";

import { useCallback, useEffect, useState } from "react";

import { DeskPage, DeskSection, GateBanner } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionStorageKey } from "@/lib/constants";

type Area = {
  id: string;
  label: string;
  description: string;
  warning: string;
  count: number;
};

type Overview = { enabled: boolean; phrase: string; areas: Area[] };

/** Removes this browser's saved copies of ERP data; the sign-in is kept. */
export function clearBrowserCopies() {
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith("sju-") && key !== sessionStorageKey) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * For the testing period: the administrator clears the data entered while testing, area by area,
 * after downloading a copy. It works only while ALLOW_TEST_DATA_RESET=true is set on the server.
 */
export function TestDataScreen() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [backedUp, setBackedUp] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const read = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/test-data", { cache: "no-store" });
      const result = (await response.json()) as Overview & {
        ok: boolean;
        message?: string;
      };
      return result.ok
        ? ({ overview: result, problem: null } as const)
        : ({
            overview: null,
            problem: result.message ?? "This could not be opened.",
          } as const);
    } catch {
      return { overview: null, problem: "This could not be opened." } as const;
    }
  }, []);

  function show(result: Awaited<ReturnType<typeof read>>) {
    setProblem(result.problem);
    if (result.overview) setOverview(result.overview);
  }

  useEffect(() => {
    let live = true;
    void read().then((result) => {
      if (!live) return;
      setProblem(result.problem);
      if (result.overview) setOverview(result.overview);
    });
    return () => {
      live = false;
    };
  }, [read]);

  function toggle(id: string) {
    setBackedUp(false);
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function call(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/test-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as Record<string, unknown> & {
      ok: boolean;
      message?: string;
    };
  }

  async function backup() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await call({ action: "export", areas: picked });
      if (!result.ok) {
        setNotice(result.message ?? "The copy could not be made.");
        return;
      }
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `erp-test-data-copy-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setBackedUp(true);
      setNotice("The copy is downloaded. Keep it private: it holds personal data.");
    } catch {
      setNotice("The copy could not be made.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await call({ action: "reset", areas: picked, confirm: phrase });
      if (!result.ok) {
        setNotice(result.message ?? "Nothing was cleared.");
        return;
      }
      const removed = clearBrowserCopies();
      setPicked([]);
      setBackedUp(false);
      setPhrase("");
      setNotice(
        `Cleared: ${(result.cleared as string[]).join(", ")}.${removed ? " The saved copies in this browser are cleared too." : ""} Ask each tester to press "Clear saved copies in this browser" on their own computer.`,
      );
      show(await read());
    } catch {
      setNotice("Nothing was cleared.");
    } finally {
      setBusy(false);
    }
  }

  if (problem) {
    return (
      <DeskPage kicker="Administration" title="Clear test data">
        <GateBanner tone="danger">{problem}</GateBanner>
      </DeskPage>
    );
  }
  if (!overview) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  const ready =
    overview.enabled && picked.length > 0 && backedUp && phrase === overview.phrase;

  return (
    <DeskPage kicker="Administration" title="Clear test data">
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      {!overview.enabled ? (
        <GateBanner tone="danger">
          Clearing is switched off. While testing, set ALLOW_TEST_DATA_RESET=true in the
          server settings (.env.local, and the hosting settings if the site is online),
          then restart. Remove it before the real work begins.
        </GateBanner>
      ) : null}
      <DeskSection title="1. Choose what to clear">
        <ul className="divide-y divide-border">
          {overview.areas.map((area) => (
            <li key={area.id} className="flex gap-3 px-4 py-3">
              <input
                id={`area-${area.id}`}
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={picked.includes(area.id)}
                onChange={() => toggle(area.id)}
                disabled={!overview.enabled}
              />
              <label htmlFor={`area-${area.id}`} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-primary">{area.label}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {area.count < 0 ? "unavailable" : `${area.count} now`}
                  </span>
                </span>
                <span className="mt-0.5 block text-justify text-sm leading-6 text-muted-foreground">
                  {area.description}
                </span>
                {area.warning ? (
                  <span className="mt-0.5 block text-xs font-medium text-secondary">
                    {area.warning}
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </DeskSection>
      <DeskSection title="2. Download a copy first">
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            A file with everything in the chosen areas, kept on your computer in case
            something was cleared by mistake.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy || picked.length === 0 || !overview.enabled}
            onClick={() => void backup()}
          >
            Download the copy
          </Button>
          {backedUp ? (
            <p className="text-sm font-medium text-primary">Copy downloaded.</p>
          ) : null}
        </div>
      </DeskSection>
      <DeskSection title="3. Confirm and clear">
        <div className="space-y-3 p-4">
          <label className="block text-sm" htmlFor="test-data-phrase">
            Type <span className="font-mono font-semibold">{overview.phrase}</span> to
            confirm
          </label>
          <Input
            id="test-data-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            className="max-w-sm"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="maroon"
            disabled={busy || !ready}
            onClick={() => void reset()}
          >
            {busy ? "Working…" : "Clear the chosen data"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Uploaded files (receipts, documents) are not removed here; they stay in
            storage unused.
          </p>
        </div>
      </DeskSection>
      <DeskSection title="This computer">
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Each browser also keeps its own saved copies of some records. Every tester can
            press this on their own computer after the data is cleared; it does not sign
            them out.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const removed = clearBrowserCopies();
              setNotice(
                removed
                  ? `Cleared ${removed} saved copies in this browser.`
                  : "This browser had no saved copies.",
              );
            }}
          >
            Clear saved copies in this browser
          </Button>
        </div>
      </DeskSection>
    </DeskPage>
  );
}
