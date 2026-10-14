import {
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { eligibility } from "@/data/eligibility";

const icons: Record<string, LucideIcon> = {
  sessions: CalendarDays,
  postgraduate: GraduationCap,
  selection: ClipboardCheck,
  "part-time": Briefcase,
};

export function Eligibility() {
  return (
    <section
      id="eligibility"
      className="scroll-mt-32 py-12 sm:py-16"
      aria-labelledby="eligibility-title"
    >
      <Container>
        <SectionHeading
          eyebrow="Eligibility"
          title="Who may apply"
          id="eligibility-title"
        />
        <ol className="relative mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <span
            className="absolute top-8 right-[8%] left-[8%] hidden h-0.5 bg-accent lg:block"
            aria-hidden="true"
          />
          {eligibility.map((item, index) => {
            const Icon = icons[item.id] ?? GraduationCap;
            return (
              <li
                key={item.id}
                className="relative flex gap-4 md:flex-col md:items-center md:text-center"
              >
                {index < eligibility.length - 1 ? (
                  <span
                    className="absolute top-16 bottom-0 left-8 w-0.5 bg-accent md:hidden"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative z-10 grid size-16 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift">
                  <Icon className="size-7" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
                    {index + 1}
                  </p>
                  <h3 className="mt-1 font-heading text-xl text-primary">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
