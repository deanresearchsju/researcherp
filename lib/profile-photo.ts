import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import type { Role } from "@/types";

export const profilePhotoMigrationHint =
  "Open the Supabase SQL editor for this project and run supabase/migrations/20261014030000_profile_photos.sql. Until then, the profile photo stays in this browser.";

const cache = new Map<string, string>();
const known = new Set<string>();
const loadingKeys = new Set<string>();
const listeners = new Set<() => void>();

export function profilePhotoKey(role: Role, identifier: string) {
  return `${role}:${identifier.trim().toLowerCase()}`;
}

function browserKey(key: string) {
  return `${storageKeys.profilePhotos}:${key}`;
}

function readBrowser(key: string) {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(browserKey(key));
  return value && value.startsWith("data:") ? value : null;
}

function writeBrowser(key: string, photo: string) {
  window.localStorage.setItem(browserKey(key), photo);
}

function publish() {
  listeners.forEach((listener) => listener());
}

export function profilePhotoReady(role: Role, identifier: string) {
  return known.has(profilePhotoKey(role, identifier));
}

export function readProfilePhoto(role: Role, identifier: string) {
  const key = profilePhotoKey(role, identifier);
  if (!known.has(key)) return null;
  return cache.get(key) || null;
}

async function loadOne(role: Role, identifier: string) {
  const key = profilePhotoKey(role, identifier);
  const supabase = createSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("profile_photos")
      .select("photo")
      .eq("id", key)
      .maybeSingle();
    if (!error) {
      const photo = data?.photo?.startsWith("data:") ? data.photo : null;
      cache.set(key, photo ?? "");
      known.add(key);
      publish();
      return;
    }
  }
  cache.set(key, readBrowser(key) ?? "");
  known.add(key);
  publish();
}

export function subscribeProfilePhoto(
  role: Role,
  identifier: string,
  onChange: () => void,
) {
  listeners.add(onChange);
  const key = profilePhotoKey(role, identifier);
  if (identifier.trim() && !known.has(key) && !loadingKeys.has(key)) {
    loadingKeys.add(key);
    void loadOne(role, identifier).finally(() => loadingKeys.delete(key));
  }
  return () => listeners.delete(onChange);
}

export async function saveProfilePhoto(role: Role, identifier: string, photo: string) {
  const key = profilePhotoKey(role, identifier);
  const supabase = createSupabase();
  if (supabase) {
    const { error } = await supabase.from("profile_photos").upsert({ id: key, photo });
    if (!error) {
      cache.set(key, photo);
      known.add(key);
      publish();
      return { ok: true as const, detail: null };
    }
  }
  if (typeof window === "undefined") return { ok: false as const, detail: null };
  writeBrowser(key, photo);
  cache.set(key, photo);
  known.add(key);
  publish();
  return { ok: true as const, detail: profilePhotoMigrationHint };
}
