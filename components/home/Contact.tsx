import { Clock, Mail, MapPin, Phone } from "lucide-react";

import { helpdeskCopy } from "@/data/helpdesk";
import { university } from "@/lib/constants";

export function Contact() {
  return (
    <section aria-label={helpdeskCopy.officeTitle}>
      <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
        <h2 className="font-heading text-2xl text-primary">{helpdeskCopy.officeTitle}</h2>
        <address className="mt-4 space-y-4 text-sm not-italic">
          <p className="flex gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {university.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </span>
          </p>
          <p className="flex gap-3">
            <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <a className="hover:underline" href={`mailto:${university.email}`}>
              {university.email}
            </a>
          </p>
          <p className="flex gap-3">
            <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <a className="hover:underline" href={`tel:${university.phone}`}>
              {university.phoneDisplay}
            </a>
          </p>
          <p className="flex gap-3">
            <Clock className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{university.hours}</span>
          </p>
        </address>
      </div>
    </section>
  );
}
