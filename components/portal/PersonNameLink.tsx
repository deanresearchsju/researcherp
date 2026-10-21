"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { DeskModal } from "@/components/portal/Desk";
import { PersonProfileScreen } from "@/components/portal/PersonProfileScreen";
import { personFileCopy } from "@/data/person-file";
import { isOfficeRole } from "@/lib/access";
import { openPersonProfileWindow } from "@/lib/person-profile";
import { usePreviewSession } from "@/lib/use-preview-session";

export function PersonNameLink({
  role,
  name,
  identifier,
}: {
  role: "scholar" | "supervisor";
  name: string;
  identifier: string;
}) {
  const pathname = usePathname();
  const session = usePreviewSession();
  const [open, setOpen] = useState(false);
  const supervisorBlocked = session?.role === "supervisor" && role === "scholar";
  const office =
    (session !== null && isOfficeRole(session.role)) ||
    (session === null && pathname.startsWith("/admin"));

  if (supervisorBlocked || !office) {
    return <span className="font-medium text-primary">{name}</span>;
  }

  return (
    <>
      <button
        type="button"
        className="font-medium text-primary underline-offset-2 hover:underline"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!openPersonProfileWindow(role, identifier, name)) {
            setOpen(true);
          }
        }}
      >
        {name}
      </button>
      {open ? (
        <DeskModal
          title={`${name} · ${personFileCopy.viewProfile}`}
          onClose={() => setOpen(false)}
        >
          <PersonProfileScreen role={role} identifier={identifier} name={name} />
        </DeskModal>
      ) : null}
    </>
  );
}
