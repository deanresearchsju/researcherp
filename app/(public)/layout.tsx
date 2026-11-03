import { Suspense } from "react";

import { PublicSiteProvider } from "@/components/home/PublicSiteProvider";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { publicSite } from "@/lib/public-site";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // The application window and the news come with the page, read once a minute for everybody.
  const site = await publicSite();
  return (
    <PublicSiteProvider settings={site.settings} news={site.news}>
      <div id="top">
        <Suspense fallback={<div className="h-36 border-b border-border bg-card" />}>
          <Navbar />
        </Suspense>
        <main id="main">{children}</main>
        <Footer />
      </div>
    </PublicSiteProvider>
  );
}
