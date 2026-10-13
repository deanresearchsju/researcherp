"use client";

import { RefreshCw, UserRound } from "lucide-react";
import { useState } from "react";
import { useSyncExternalStore } from "react";

import { university, fileLimits } from "@/lib/constants";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { fileError, fileToDataUrl } from "@/lib/files";
import { sameId } from "@/lib/office";
import { portraitFor, currentPortraits, subscribePortraits } from "@/lib/portraits";
import {
  profilePhotoReady,
  readProfilePhoto,
  saveProfilePhoto,
  subscribeProfilePhoto,
} from "@/lib/profile-photo";
import {
  registrationOf,
  scholarBySignIn,
  scholarsGuidedBy,
  supervisorForGuide,
  currentAllotments,
  subscribeRegister,
} from "@/lib/register";
import {
  useOfficeView,
  usePortalSession,
  usePreviewSession,
} from "@/lib/use-preview-session";
import type { Role } from "@/types";

function rowsFor(role: Role, identifier: string, name: string) {
  if (role === "supervisor") {
    const guide = supervisorForGuide(name) ?? supervisorForGuide(identifier);
    const email = guide?.email.trim() || (identifier.includes("@") ? identifier : "");
    return [
      ["Name", name],
      ["Supervisor ID", guide?.supervisorId.trim() || "—"],
      ["Email ID", email || "—"],
      ["Phone", guide?.phone.trim() || "—"],
      ["Department", guide?.department.trim() || "—"],
      ["Designation", guide?.designation.trim() || "—"],
      ["Campus", guide?.campus.trim() || "—"],
      ["Scholars", String(scholarsGuidedBy(name, identifier).length)],
    ];
  }

  const scholar = scholarBySignIn(identifier);
  const allotments = currentAllotments();
  const doctoral = currentDoctoral();
  const semesters =
    doctoral?.registrations
      .filter((item) => sameId(item.scholarIdentifier, identifier))
      .map((item) => item.semester) ?? [];
  const semester = semesters.length > 0 ? String(Math.max(...semesters)) : "—";
  const programme = scholar?.department.trim()
    ? `Ph.D. - ${scholar.department.trim()}`
    : "Ph.D.";
  return [
    ["Student Name", scholar?.name || name],
    ["Student ID", scholar?.fileNumber.trim() || "—"],
    ["Register No.", scholar ? registrationOf(scholar, allotments) || "—" : "—"],
    ["Email ID", scholar?.email.trim() || (identifier.includes("@") ? identifier : "—")],
    ["Institution", scholar?.institution.trim() || university.name],
    ["Program", programme],
    ["Semester", semester],
  ];
}

export function ProfileCard({ role }: { role: Extract<Role, "scholar" | "supervisor"> }) {
  const session = usePortalSession();
  const own = usePreviewSession();
  const view = useOfficeView();
  const identifier = session && session.role === role ? session.identifier : "";
  const name =
    session && session.role === role ? session.name.trim() || session.identifier : "";
  const photo = useSyncExternalStore(
    (onChange) => subscribeProfilePhoto(role, identifier, onChange),
    () => readProfilePhoto(role, identifier),
    () => null,
  );
  const ready = useSyncExternalStore(
    (onChange) => subscribeProfilePhoto(role, identifier, onChange),
    () => profilePhotoReady(role, identifier),
    () => false,
  );
  const portraits = useSyncExternalStore(
    subscribePortraits,
    currentPortraits,
    () => null,
  );
  useSyncExternalStore(subscribeRegister, currentAllotments, currentAllotments);
  useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = photo || (identifier ? portraitFor(portraits, identifier, name) : null);
  const officeCanChange = own?.role === "admin" && view?.role === role;
  const canSet = ready && identifier && !photo && !officeCanChange;
  const canChange = ready && identifier && officeCanChange;

  async function onFile(file: File | undefined) {
    if (!file || !identifier) return;
    const problem = fileError(file, "photo", true);
    if (problem) {
      setNotice(problem);
      return;
    }
    setBusy(true);
    const data = await fileToDataUrl(file).catch(() => "");
    if (!data) {
      setBusy(false);
      setNotice("The photo could not be read.");
      return;
    }
    const saved = await saveProfilePhoto(role, identifier, data);
    setBusy(false);
    setNotice(
      saved.ok ? "The profile photo is saved." : "The profile photo could not be saved.",
    );
  }

  const rows = identifier ? rowsFor(role, identifier, name) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_18rem]">
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 bg-primary px-4 py-3 text-primary-foreground">
          <UserRound className="size-4" aria-hidden="true" />
          <h2 className="text-sm font-semibold">
            {role === "scholar" ? "Student Profile" : "Supervisor Profile"}
          </h2>
        </div>
        <dl>
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[9.5rem_1fr] gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
            >
              <dt className="text-muted-foreground">{label}</dt>
              <dd
                className={
                  label === "Email ID"
                    ? "font-medium break-all text-foreground"
                    : "font-semibold break-words text-primary uppercase"
                }
              >
                {value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-8 shadow-card">
        <div className="grid size-40 place-items-center overflow-hidden rounded-full border-4 border-primary bg-accent">
          {shown ? (
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <UserRound className="size-16 text-primary" aria-hidden="true" />
          )}
        </div>
        <p className="mt-4 text-sm text-foreground">
          Current Status: <span className="font-semibold text-primary">Active</span>
        </p>
        {canSet || canChange ? (
          <label
            data-readonly-allow=""
            className="mt-4 grid size-10 cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            <span className="sr-only">
              {canChange ? "Replace profile photo" : "Upload profile photo"}
            </span>
            <input
              type="file"
              accept={fileLimits.photo.accept}
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onFile(file);
              }}
            />
          </label>
        ) : null}
        {canSet ? (
          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            Upload a photo once. {fileLimits.photo.label}. A later change is made by the
            research office.
          </p>
        ) : null}
        {canChange ? (
          <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
            Replace this photo. {fileLimits.photo.label}.
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-3 text-center text-sm text-secondary">
            {notice}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function ProfilePhotoChange({
  role,
  identifier,
}: {
  role: Role;
  identifier: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const problem = fileError(file, "photo", true);
    if (problem) {
      setNotice(problem);
      return;
    }
    const data = await fileToDataUrl(file).catch(() => "");
    if (!data) {
      setNotice("The photo could not be read.");
      return;
    }
    const saved = await saveProfilePhoto(role, identifier, data);
    setNotice(saved.ok ? "Photo updated." : "The photo could not be saved.");
  }

  return (
    <label data-readonly-allow="" className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex h-8 cursor-pointer items-center rounded-full border border-border px-3 text-xs font-semibold text-primary">
        Change photo
      </span>
      <input
        type="file"
        accept={fileLimits.photo.accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void onFile(file);
        }}
      />
      {notice ? <span className="text-xs text-secondary">{notice}</span> : null}
    </label>
  );
}
