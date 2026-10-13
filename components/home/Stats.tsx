"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { Container } from "@/components/ui/container";
import { stats } from "@/data/stats";
import { sectionCopy } from "@/data/sections";
import { formatInr } from "@/lib/utils";

function useCount(target: number, active: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const duration = 1100;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);

  return value;
}

function StatFigure({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  const count = useCount(value, active && reduce !== true);
  const shown = reduce ? value : count;
  return (
    <div className="text-center">
      <p className="font-heading text-4xl text-accent sm:text-5xl">{formatInr(shown)}</p>
      <p className="mt-2 text-sm text-white/80">{label}</p>
    </div>
  );
}

export function Stats() {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  const copy = sectionCopy.stats;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setActive(true);
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="bg-primary py-16 text-primary-foreground"
      aria-labelledby="stats-title"
    >
      <Container>
        <p className="text-center text-xs font-semibold tracking-[0.22em] text-accent uppercase">
          {copy.eyebrow}
        </p>
        <h2 id="stats-title" className="mt-3 text-center font-heading text-3xl">
          {copy.title}
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((item) => (
            <StatFigure
              key={item.id}
              label={item.label}
              value={item.value}
              active={active}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
