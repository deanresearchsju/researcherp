import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <Logo className="mx-auto h-16 w-auto" />
        <h1 className="mt-6 font-heading text-4xl text-primary">Page not found</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          That address is not part of the research portal. Return home or sign in.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className={buttonVariants()}>
            Home
          </Link>
          <Link href="/login/scholar" className={buttonVariants({ variant: "outline" })}>
            Scholar login
          </Link>
        </div>
      </div>
    </main>
  );
}
