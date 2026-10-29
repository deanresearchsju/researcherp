import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { footerExplore, footerPortals } from "@/data/navigation";
import { copyrightYear, footerCredit, university } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-purple-deep text-white">
      <div className="h-px bg-accent" />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="md:col-span-2 lg:col-span-1">
          <div className="inline-flex rounded-xl bg-white p-2">
            <Logo className="h-12 w-auto" alt="" />
          </div>
          <p className="mt-4 text-sm leading-6 text-white/80">{university.affiliation}</p>
          <p className="mt-1 text-sm leading-6 text-white/80">{university.unit}</p>
          <p className="mt-3 font-heading text-lg text-accent">{university.tagline}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-[0.16em] text-accent uppercase">
            Explore
          </h2>
          <ul className="mt-4 space-y-2">
            {footerExplore.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-sm text-white/80 hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-[0.16em] text-accent uppercase">
            Portals
          </h2>
          <ul className="mt-4 space-y-2">
            {footerPortals.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="text-sm text-white/80 hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-[0.16em] text-accent uppercase">
            Contact
          </h2>
          <address className="mt-4 space-y-1 text-sm leading-6 text-white/80 not-italic">
            {university.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <a
              className="mt-2 block hover:text-white"
              href={`mailto:${university.email}`}
            >
              {university.email}
            </a>
            <a className="block hover:text-white" href={`tel:${university.phone}`}>
              {university.phoneDisplay}
            </a>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-center text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <span>Designed by {footerCredit.designedBy}.</span>
          <span>Developed by {university.researchOffice}.</span>
          <span>
            Copyright {copyrightYear} © {university.name}.
          </span>
        </p>
      </div>
    </footer>
  );
}
