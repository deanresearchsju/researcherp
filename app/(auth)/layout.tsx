import type { Metadata } from "next";

/** Sign-in pages are for members; they stay out of search results. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
