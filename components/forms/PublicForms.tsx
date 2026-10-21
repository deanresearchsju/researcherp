"use client";

import { useEffect, useState } from "react";

import {
  formDownloadHref,
  formKindLabel,
  formSizeLabel,
  listForms,
  type PortalForm,
} from "@/lib/portal-forms";

/** Forms the research office has published to the public website. */
export function PublicForms() {
  const [forms, setForms] = useState<PortalForm[]>([]);

  useEffect(() => {
    let live = true;
    void listForms().then((result) => {
      if (live && result.ok) setForms(result.forms);
    });
    return () => {
      live = false;
    };
  }, []);

  return forms.map((form) => (
    <li
      key={form.id}
      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h2 className="font-semibold text-primary">{form.title}</h2>
        <p className="text-sm text-muted-foreground">{form.category}</p>
      </div>
      <a
        href={formDownloadHref(form.id)}
        className="text-sm font-semibold text-primary hover:underline"
      >
        Download {formKindLabel(form.fileName) === "PDF" ? "PDF" : "DOCX"} ·{" "}
        {formSizeLabel(form.fileSize)}
      </a>
    </li>
  ));
}
