"use client";

import { Camera, Mail, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { useSyncExternalStore } from "react";

import { university, fileLimits } from "@/lib/constants";
import { currentDoctoral, subscribeDoctoral } from "@/lib/doctoral";
import { fileError, fileToDataUrl } from "@/lib/files";
import {
  allocationFor,
  currentOffice,
  sameId,
  scholarsStillGuidedBy,
  subscribeOffice,
} from "@/lib/office";
import { scholarSemesterLabel } from "@/lib/scholar-identity";
import { portraitFor, currentPortraits, subscribePortraits } from "@/lib/portraits";
import {
  profilePhotoReady,
  readProfilePhoto,
  saveProfilePhoto,
  subscribeProfilePhoto,
} from "@/lib/profile-photo";
import {
  batchOf,
  registrationOf,
  scholarBySignIn,
  supervisorForGuide,
  currentAllotments,
  subscribeRegister,
} from "@/lib/register";
import { researchTitleOf } from "@/lib/research-title";
import { admissionCaseForIdentifier, currentAdmission } from "@/lib/admission";
import { guideHiddenCopy, guideReleased } from "@/lib/guide-release";
import { currentPortalUsers, subscribePortalUsers } from "@/lib/users";
import { currentScholarRecords, subscribeScholarRecords } from "@/lib/scholar-records";
import { Badge } from "@/components/ui/badge";
import {
  useOfficeView,
  usePortalSession,
  usePreviewSession,
} from "@/lib/use-preview-session";
import type { Role } from "@/types";

function scholarFacts(identifier: string, name: string) {
  const scholar = scholarBySignIn(identifier);
  const allotments = currentAllotments();
  const doctoral = currentDoctoral();
  const enrollment = doctoral?.enrollments.find((item) =>
    sameId(item.scholarIdentifier, identifier),
  );
  const subject = scholar?.department.trim() || enrollment?.school.trim() || "";
  const mode = enrollment?.studyMode.trim() || scholar?.category.trim() || "";
  return {
    title: scholar?.name || name,
    subtitle: subject ? `Ph.D. · ${subject}` : "Ph.D. scholar",
    chips: [
      [
        "Registration No.",
        scholar
          ? registrationOf(scholar, allotments) || "To be allotted"
          : "To be allotted",
      ],
      ["Batch", scholar ? (batchOf(scholar.batchId)?.name ?? "—") : "—"],
      ["Mode", mode || "—"],
      ["Semester", scholarSemesterLabel(identifier)],
    ] as [string, string][],
    rows: [
      ["Email", scholar?.email.trim() || (identifier.includes("@") ? identifier : "—")],
      ["Phone", scholar?.phone.trim() || "—"],
      ["Institution", scholar?.institution.trim() || university.name],
      [
        "Application No.",
        scholar?.applicationNumber.trim() ||
          admissionCaseForIdentifier(identifier, currentAdmission()?.cases ?? [])
            ?.applicationNo ||
          (/^SJU\//i.test(identifier) ? identifier : "—"),
      ],
    ] as [string, string][],
  };
}

function supervisorFacts(identifier: string, name: string) {
  const guide = supervisorForGuide(name) ?? supervisorForGuide(identifier);
  const email = guide?.email.trim() || (identifier.includes("@") ? identifier : "");
  const scholars =
    (currentOffice()?.allocations.filter((item) =>
      sameId(item.supervisorIdentifier, identifier),
    ).length ?? 0) +
    scholarsStillGuidedBy(name, identifier, currentOffice()?.allocations ?? []).length;
  return {
    title: guide?.name || name,
    subtitle:
      [guide?.designation.trim(), guide?.department.trim()].filter(Boolean).join(" · ") ||
      "Research supervisor",
    chips: [
      ["Supervisor ID", guide?.supervisorId.trim() || "—"],
      ["Campus", guide?.campus.trim() || "—"],
      ["Scholars", String(scholars)],
    ] as [string, string][],
    rows: [
      ["Email", email || "—"],
      ["Phone", guide?.phone.trim() || "—"],
      ["Research area", guide?.researchArea.trim() || "—"],
    ] as [string, string][],
  };
}

/** The scholar's guide: the allotment first, then the register. */
function guideFacts(identifier: string) {
  const allocation = allocationFor(currentOffice()?.allocations ?? [], identifier);
  const scholar = scholarBySignIn(identifier);
  const name = allocation?.supervisorName.trim() || scholar?.guideName.trim() || "";
  if (!name) return null;
  const guide =
    supervisorForGuide(name) ??
    (allocation ? supervisorForGuide(allocation.supervisorIdentifier) : null);
  const account = currentPortalUsers()?.users.find(
    (user) =>
      user.role === "supervisor" &&
      (sameId(user.name, name) ||
        (allocation ? sameId(user.identifier, allocation.supervisorIdentifier) : false)),
  );
  const email =
    guide?.email.trim() ||
    (account?.identifier.includes("@") ? account.identifier : "") ||
    (allocation?.supervisorIdentifier.includes("@")
      ? allocation.supervisorIdentifier
      : "");
  return {
    name: guide?.name || name,
    role: [guide?.designation.trim(), guide?.department.trim()]
      .filter(Boolean)
      .join(" · "),
    email,
    phone: guide?.phone.trim() || "",
  };
}

const titleTone = {
  "Not fixed": "outline",
  Proposed: "outline",
  Provisional: "purple",
  Final: "gold",
  Locked: "maroon",
} as const;

export function ProfileCard({
  role,
  identifier: identifierProp,
  name: nameProp,
}: {
  role: Extract<Role, "scholar" | "supervisor">;
  identifier?: string;
  name?: string;
}) {
  const session = usePortalSession();
  const own = usePreviewSession();
  const view = useOfficeView();
  const identifier =
    identifierProp?.trim() ||
    (session && session.role === role ? session.identifier : "");
  const name =
    nameProp?.trim() ||
    (session && session.role === role ? session.name.trim() || session.identifier : "");
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
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  useSyncExternalStore(subscribeOffice, currentOffice, () => null);
  const titleChanges = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("title_change", onChange),
    () => currentScholarRecords("title_change"),
    () => null,
  );
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

  if (!identifier) return null;
  const facts =
    role === "scholar"
      ? scholarFacts(identifier, name)
      : supervisorFacts(identifier, name);
  const title =
    role === "scholar" && doctoral
      ? researchTitleOf(doctoral, identifier, titleChanges?.records ?? [])
      : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="relative bg-gradient-to-r from-primary via-purple-deep to-primary px-5 pt-5 pb-14 text-primary-foreground sm:px-7">
        <p className="text-[0.65rem] font-bold tracking-[0.2em] text-accent uppercase">
          {role === "scholar" ? "Scholar profile" : "Supervisor profile"}
        </p>
        <span className="absolute top-5 right-5 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          Active
        </span>
      </div>
      <div className="-mt-12 flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-end sm:px-7">
        <div className="relative shrink-0">
          <div className="grid size-28 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-accent shadow-lift">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="" className="size-full object-cover" />
            ) : (
              <UserRound className="size-12 text-primary" aria-hidden="true" />
            )}
          </div>
          {canSet || canChange ? (
            <label
              data-readonly-allow=""
              className="absolute -right-2 -bottom-2 grid size-9 cursor-pointer place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-card"
            >
              <Camera className="size-4" aria-hidden="true" />
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
        </div>
        <div className="min-w-0 flex-1 sm:pb-1">
          <h1 className="font-heading text-2xl text-primary sm:text-3xl">
            {facts.title}
          </h1>
          <p className="text-sm text-muted-foreground">{facts.subtitle}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
        {facts.chips.map(([label, value]) => (
          <div key={label} className="bg-card px-5 py-3">
            <dt className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              {label}
            </dt>
            <dd className="mt-0.5 font-semibold break-words text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      {title ? (
        <div className="border-b border-border px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Research title
            </p>
            <Badge variant={titleTone[title.stage]}>{title.stage}</Badge>
          </div>
          <p className="mt-1 font-semibold text-primary">
            {title.title || "Not fixed yet"}
          </p>
          <p className="text-xs text-muted-foreground">{title.note}</p>
        </div>
      ) : null}
      <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2 sm:px-7">
        {facts.rows.map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 font-medium break-words text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      {role === "scholar" ? <GuideBlock identifier={identifier} /> : null}
      {canSet ? (
        <p className="px-5 pb-4 text-xs text-muted-foreground sm:px-7">
          Add your photo once with the camera button. {fileLimits.photo.label}. A later
          change is made by the research office.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="px-5 pb-4 text-sm text-secondary sm:px-7">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

function GuideBlock({ identifier }: { identifier: string }) {
  const viewer = usePreviewSession();
  const payments = useSyncExternalStore(
    (onChange) => subscribeScholarRecords("payment", onChange),
    () => currentScholarRecords("payment"),
    () => null,
  );
  useSyncExternalStore(subscribePortalUsers, currentPortalUsers, () => null);
  const guide = guideFacts(identifier);
  const hidden =
    viewer?.role === "scholar" && !guideReleased(identifier, payments?.records ?? []);
  return (
    <div className="border-t border-border bg-muted/30 px-5 py-4 sm:px-7">
      <p className="text-[0.65rem] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        Research supervisor (Guide)
      </p>
      {hidden ? (
        <p className="mt-1 text-sm text-muted-foreground">{guideHiddenCopy}</p>
      ) : guide ? (
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <p className="font-semibold text-primary">{guide.name}</p>
            {guide.role ? (
              <p className="text-sm text-muted-foreground">{guide.role}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {guide.email ? (
              <a
                href={`mailto:${guide.email}`}
                className="inline-flex items-center gap-1.5 break-all text-primary underline-offset-4 hover:underline"
              >
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                {guide.email}
              </a>
            ) : (
              <span className="text-muted-foreground">Email not on record</span>
            )}
            {guide.phone ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                {guide.phone}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Not allotted yet.</p>
      )}
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
