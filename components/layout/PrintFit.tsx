"use client";

import { useEffect } from "react";

/** Printable height of one A4 sheet: 297 mm less the 10 mm print margins (see globals.css). */
const sheetHeightPx = (276 * 96) / 25.4;

/**
 * Keeps every printed sheet (`.pdf-page`) inside one A4 page. Each sheet is measured at its
 * printed width; one that would run past the bottom gets a scale (`--fit`) that the print
 * stylesheet applies, so the header, table and signature lines are never cut off.
 */
export function PrintFit() {
  useEffect(() => {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:190mm;pointer-events:none";
    document.body.appendChild(probe);

    function fit(page: HTMLElement) {
      const clone = page.cloneNode(true) as HTMLElement;
      clone.style.cssText =
        "width:190mm;min-width:0;max-width:none;height:auto;min-height:0;max-height:none;overflow:visible;margin:0;box-shadow:none";
      probe.replaceChildren(clone);
      const natural = clone.scrollHeight;
      probe.replaceChildren();
      const scale =
        natural > sheetHeightPx ? Math.max(0.5, (sheetHeightPx / natural) * 0.98) : 1;
      page.style.setProperty("--fit", scale.toFixed(3));
    }

    function run() {
      document.querySelectorAll<HTMLElement>(".pdf-page").forEach(fit);
    }

    let timer: number | undefined;
    const observer = new MutationObserver((records) => {
      if (records.every((record) => probe.contains(record.target))) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 250);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener("beforeprint", run);
    run();
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", run);
      window.clearTimeout(timer);
      probe.remove();
    };
  }, []);
  return null;
}
