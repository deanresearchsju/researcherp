"use client";

import { useState } from "react";

import { Reveal } from "@/components/home/Reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { announcements } from "@/data/announcements";
import { sectionCopy } from "@/data/sections";

export function Announcements() {
  const [open, setOpen] = useState(false);
  const visible = open ? announcements : announcements.slice(0, 3);
  const copy = sectionCopy.announcements;
  const ticker = [...announcements, ...announcements];

  return (
    <section
      id="announcements"
      className="py-16 sm:py-20"
      aria-labelledby="announcements-title"
    >
      <div
        className="ticker overflow-hidden border-y border-border bg-white"
        aria-hidden="true"
      >
        <div className="ticker-track flex w-max gap-8 py-3">
          {ticker.map((item, index) => (
            <p key={`${item.id}-${index}`} className="text-sm text-foreground">
              <span className="font-semibold text-primary">{item.date}.</span>{" "}
              {item.title}
            </p>
          ))}
        </div>
      </div>
      <Container className="pt-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            id="announcements-title"
          />
          <Button
            variant="outline"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? copy.viewLess : copy.viewAll}
          </Button>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {visible.map((item, index) => (
            <Reveal key={item.id} delay={index * 0.05}>
              <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Badge>{item.category}</Badge>
                  <time
                    dateTime={item.isoDate}
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {item.date}
                  </time>
                </div>
                <h3 className="mt-4 font-heading text-xl text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.summary}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
