"use client";

import { Camera, ExternalLink, ImageOff } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ImageCropper } from "@/components/forms/ImageCropper";
import { DeskPage, DeskTable, FormDialog } from "@/components/portal/Desk";
import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { researchRegister } from "@/data/research-register";
import { fileLimits } from "@/lib/constants";
import { compressImage, fileToDataUrl } from "@/lib/files";
import {
  fetchProfilePhotos,
  profilePhotoKey,
  saveProfilePhoto,
} from "@/lib/profile-photo";
import {
  bioWordLimit,
  currentProfiles,
  currentQuotas,
  removeSupervisorProfile,
  saveSupervisorProfile,
  subscribeRegister,
  vidwanLink,
  wordCount,
  type SupervisorProfile,
} from "@/lib/register";

type Person = {
  key: string;
  name: string;
  designation: string;
  department: string;
  researchArea: string;
};

const keyOf = (value: string) => value.trim().toLowerCase();

function useDirectory(): Person[] {
  const quotas = useSyncExternalStore(subscribeRegister, currentQuotas, currentQuotas);
  const registered: Person[] = researchRegister.supervisors.map((item) => ({
    key: keyOf(item.email || item.supervisorId || item.name),
    name: item.name,
    designation: item.designation,
    department: item.department,
    researchArea: item.researchArea,
  }));
  const known = new Set(registered.map((item) => item.name.toLowerCase()));
  const approved: Person[] = quotas
    .filter((item) => !known.has(item.name.toLowerCase()))
    .map((item) => ({
      key: keyOf(item.name),
      name: item.name,
      designation: item.designation,
      department: item.department,
      researchArea: "",
    }));
  return [...registered, ...approved].sort((a, b) => a.name.localeCompare(b.name));
}

function PhotoField({ profileKey, name }: { profileKey: string; name: string }) {
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);

  useEffect(() => {
    let live = true;
    void fetchProfilePhotos("supervisor", [profileKey]).then((found) => {
      if (live) setPhoto(found.get(profilePhotoKey("supervisor", profileKey)) ?? null);
    });
    return () => {
      live = false;
    };
  }, [profileKey]);

  async function save(cropped: File) {
    setBusy(true);
    setMessage(null);
    try {
      const small = await compressImage(cropped, fileLimits.photo.maxBytes);
      const data = await fileToDataUrl(small);
      await saveProfilePhoto("supervisor", profileKey, data);
      setPhoto(data);
      setMessage("Photo saved.");
    } catch {
      setMessage("That photo could not be saved. Try a smaller JPG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/40 p-3">
      <div className="grid h-[5.6rem] w-[4.4rem] shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-card">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${name} photo`} className="size-full object-cover" />
        ) : (
          <ImageOff className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-semibold text-primary">
          {photo === undefined
            ? "Loading photo…"
            : photo
              ? "Photograph"
              : "No photograph yet"}
        </p>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-primary hover:bg-muted">
          <Camera className="size-4" aria-hidden="true" />
          {busy ? "Saving…" : photo ? "Change photograph" : "Upload photograph"}
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!/^image\/(jpeg|png)$/.test(file.type)) {
                setMessage("Choose a JPG or PNG photograph.");
                return;
              }
              setMessage(null);
              setPending(file);
            }}
          />
        </label>
        {message ? (
          <p role="status" className="text-xs text-secondary">
            {message}
          </p>
        ) : null}
      </div>
      {pending ? (
        <ImageCropper
          file={pending}
          aspect={3.5 / 4.5}
          maxBytes={fileLimits.photo.maxBytes}
          onCancel={() => setPending(null)}
          onConfirm={(cropped) => {
            setPending(null);
            void save(cropped);
          }}
          onError={(text) => {
            setPending(null);
            setMessage(text);
          }}
        />
      ) : null}
    </div>
  );
}

function ProfileDialog({
  person,
  existing,
  onClose,
  onSaved,
}: {
  person: Person;
  existing: SupervisorProfile | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [vidwan, setVidwan] = useState(existing?.vidwan ?? "");
  const [area, setArea] = useState(existing?.researchArea || person.researchArea);
  const [published, setPublished] = useState(existing?.published ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = wordCount(bio);
  const link = vidwanLink(vidwan);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const saved = await saveSupervisorProfile({
      key: person.key,
      name: person.name,
      designation: person.designation,
      department: person.department,
      researchArea: area.trim(),
      bio,
      vidwan,
      published,
    });
    setBusy(false);
    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    onSaved(`${person.name}: website profile saved.`);
  }

  return (
    <FormDialog
      title={`Website profile · ${person.name}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Save profile"
      size="lg"
    >
      <p className="text-sm text-muted-foreground">
        {[person.designation, person.department].filter(Boolean).join(" · ")}
      </p>
      <PhotoField profileKey={person.key} name={person.name} />
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-primary">Area of research</span>
        <textarea
          rows={2}
          value={area}
          onChange={(event) => setArea(event.target.value)}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="flex items-center justify-between gap-2 font-semibold text-primary">
          Biography
          <span
            className={
              words > bioWordLimit
                ? "text-xs text-secondary"
                : "text-xs text-muted-foreground"
            }
          >
            {words} / {bioWordLimit} words
          </span>
        </span>
        <textarea
          rows={6}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-sm"
          placeholder="A short biography of up to 200 words."
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold text-primary">Vidwan ID</span>
        <Input
          value={vidwan}
          placeholder="Vidwan ID, or the full address of the Vidwan profile"
          onChange={(event) => setVidwan(event.target.value)}
        />
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Check the link <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </label>
      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
        />
        Show on the public Supervisors page
      </label>
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
    </FormDialog>
  );
}

/**
 * The research office prepares each supervisor's profile for the public Supervisors page:
 * photograph, a biography of up to 200 words, the area of research and a clickable Vidwan link.
 */
export function SupervisorProfilesScreen() {
  const directory = useDirectory();
  const profiles = useSyncExternalStore(
    subscribeRegister,
    currentProfiles,
    currentProfiles,
  );
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = directory.filter((person) =>
    textMatches(query, [person.name, person.department, person.designation]),
  );
  const profileOf = (person: Person) =>
    profiles.find((item) => item.key === person.key) ?? null;

  return (
    <DeskPage kicker="Website" title="Supervisor profiles">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Prepare what the public Supervisors page shows for each supervisor: a photograph,
        a biography of up to {bioWordLimit} words, the area of research and the Vidwan ID,
        which becomes a clickable link. Only profiles marked Show on the website appear
        there.
      </p>
      {notice ? (
        <p role="status" className="text-sm font-medium text-secondary">
          {notice}
        </p>
      ) : null}
      <ListToolbar
        query={query}
        onQuery={setQuery}
        filters={[]}
        shown={rows.length}
        total={directory.length}
        filename="supervisor-profiles.csv"
        title="Supervisor profiles (website)"
        headers={[
          "Supervisor",
          "Designation",
          "Department",
          "Biography words",
          "Vidwan ID",
          "On website",
        ]}
        rows={rows.map((person) => {
          const profile = profileOf(person);
          return [
            person.name,
            person.designation,
            person.department,
            String(wordCount(profile?.bio ?? "")),
            profile?.vidwan ?? "",
            profile?.published ? "Yes" : "No",
          ];
        })}
      />
      <DeskTable
        headers={["Supervisor", "Biography", "Vidwan", "Website", ""]}
        empty={rows.length === 0}
      >
        {rows.map((person) => {
          const profile = profileOf(person);
          const words = wordCount(profile?.bio ?? "");
          return (
            <tr key={person.key} className="border-t border-border align-top">
              <td className="px-4 py-3">
                <p className="font-semibold text-primary">{person.name}</p>
                <p className="text-muted-foreground">
                  {[person.designation, person.department].filter(Boolean).join(" · ")}
                </p>
              </td>
              <td className="px-4 py-3">
                {words > 0 ? (
                  `${words} words`
                ) : (
                  <span className="text-muted-foreground">Not written</span>
                )}
              </td>
              <td className="px-4 py-3">
                {profile?.vidwan ? (
                  <a
                    href={vidwanLink(profile.vidwan)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {profile.vidwan.length > 24 ? "Profile" : profile.vidwan}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge variant={profile?.published ? "gold" : "outline"}>
                  {profile?.published ? "Shown" : profile ? "Hidden" : "Not set"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={profile ? "outline" : "gold"}
                    onClick={() => {
                      setNotice(null);
                      setEditing(person);
                    }}
                  >
                    {profile ? "Edit profile" : "Add profile"}
                  </Button>
                  {profile ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          !window.confirm(`Remove the website profile of ${person.name}?`)
                        )
                          return;
                        void removeSupervisorProfile(person.key).then((saved) =>
                          setNotice(saved.ok ? "Profile removed." : saved.message),
                        );
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          );
        })}
      </DeskTable>
      {editing ? (
        <ProfileDialog
          person={editing}
          existing={profileOf(editing)}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      ) : null}
    </DeskPage>
  );
}
