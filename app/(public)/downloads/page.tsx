import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { downloads } from "@/data/downloads";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Downloads",
  description: `Ph.D. forms, guidelines, and regulations from ${university.name}.`,
  alternates: { canonical: "/downloads" },
};

export default function DownloadsPage() {
  const copy = pageHeroes.downloads;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <ul className="mx-auto w-full max-w-6xl divide-y divide-border px-4 py-8 sm:px-6 lg:px-8">
        {downloads.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-semibold text-primary">{item.title}</h2>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            {item.href ? (
              <Link
                href={item.href}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Download {item.note}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
