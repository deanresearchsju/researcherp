"use client";

import Link from "next/link";

import { openOfficeView } from "@/lib/office-view";

export function PersonNameLink({
  role,
  name,
  identifier,
}: {
  role: "scholar" | "supervisor";
  name: string;
  identifier: string;
}) {
  return (
    <Link
      href={`/${role}/dashboard`}
      className="font-medium text-primary underline-offset-2 hover:underline"
      onClick={() =>
        openOfficeView({
          role,
          name,
          identifier,
        })
      }
    >
      {name}
    </Link>
  );
}
