import { Suspense } from "react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="top">
      <Suspense fallback={<div className="h-28 border-b border-border bg-white" />}>
        <Navbar />
      </Suspense>
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
}
