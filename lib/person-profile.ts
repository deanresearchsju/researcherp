export function personProfilePath(
  role: "scholar" | "supervisor",
  identifier: string,
  name: string,
) {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  const query = params.toString();
  return `/admin/profile/${role}/${encodeURIComponent(identifier)}${query ? `?${query}` : ""}`;
}

export function openPersonProfileWindow(
  role: "scholar" | "supervisor",
  identifier: string,
  name: string,
) {
  if (typeof window === "undefined") return false;
  const key = `sju-profile-${role}-${identifier}`;
  const popup = window.open(
    personProfilePath(role, identifier, name),
    key,
    "popup=yes,width=1200,height=860,scrollbars=yes,resizable=yes",
  );
  popup?.focus();
  return Boolean(popup);
}
