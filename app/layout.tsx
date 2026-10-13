import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { university } from "@/lib/constants";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const description = `Ph.D. admissions, scholar milestones, and supervisor recognition at ${university.name}. ${university.tagline}.`;

export const metadata: Metadata = {
  metadataBase: new URL(university.siteUrl),
  title: {
    default: `${university.researchOffice} | ${university.name}`,
    template: `%s | ${university.name}`,
  },
  description,
  applicationName: `${university.name} ${university.productName}`,
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: `${university.name} Research`,
    title: `${university.researchOffice} | ${university.name}`,
    description,
    images: [
      {
        url: "/assets/og.jpeg",
        width: 1200,
        height: 630,
        alt: `${university.name} ${university.researchOffice}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${university.researchOffice} | ${university.name}`,
    description,
    images: ["/assets/og.jpeg"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-primary"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
