import Link from "next/link";
import type { SVGProps } from "react";

import { Logo } from "@/components/brand/Logo";
import { footerExplore, footerPortals } from "@/data/navigation";
import { copyrightYear, university } from "@/lib/constants";

function SocialIcon({ path, ...props }: SVGProps<SVGSVGElement> & { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path d={path} />
    </svg>
  );
}

const socialIcons = {
  Facebook: (props: SVGProps<SVGSVGElement>) => (
    <SocialIcon
      {...props}
      path="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1Z"
    />
  ),
  X: (props: SVGProps<SVGSVGElement>) => (
    <SocialIcon
      {...props}
      path="M14.7 10.3 22.2 2h-1.8l-6.5 7.2L8.8 2H2.2l7.9 11.1L2.2 22h1.8l7-7.7L15.2 22h6.6l-8.1-11.7Zm-2.5 2.8-.8-1.1L4.6 3.3h2.8l5.2 7.2.8 1.1 6.8 9.4h-2.8l-5.2-7.9Z"
    />
  ),
  YouTube: (props: SVGProps<SVGSVGElement>) => (
    <SocialIcon
      {...props}
      path="M23 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C19.2 5.4 12 5.4 12 5.4s-7.2 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.6.4 8.8.4 8.8.4s7.2 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6ZM9.8 15.5v-6.6l6.2 3.3-6.2 3.3Z"
    />
  ),
  LinkedIn: (props: SVGProps<SVGSVGElement>) => (
    <SocialIcon
      {...props}
      path="M6.5 9H3.7v11.3h2.8V9ZM5.1 3.7A1.7 1.7 0 1 0 5.1 7a1.7 1.7 0 0 0 0-3.3ZM20.3 20.3h-2.8v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.6H10.8V9h2.7v1.5h.1c.4-.7 1.3-1.5 2.7-1.5 2.9 0 3.4 1.9 3.4 4.4v6.9Z"
    />
  ),
} as const;

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
          <ul className="mt-4 flex gap-2">
            {university.social.map((item) => {
              const Icon = socialIcons[item.label as keyof typeof socialIcons];
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="grid size-9 place-items-center rounded-full border border-white/20 hover:bg-white/10"
                    aria-label={item.label}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon className="size-4" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {copyrightYear} {university.name}. {university.researchOffice}.
          </p>
          <p>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <span aria-hidden="true"> · </span>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
