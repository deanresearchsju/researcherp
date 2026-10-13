import { officeViewEventName, storageKeys } from "@/lib/constants";

export type OfficeView = {
  role: "scholar" | "supervisor";
  name: string;
  identifier: string;
};

let cache: OfficeView | null = null;

function readOfficeView(): OfficeView | null {
  try {
    const raw = window.sessionStorage.getItem(storageKeys.officeView);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfficeView>;
    if (
      (parsed.role !== "scholar" && parsed.role !== "supervisor") ||
      !parsed.name?.trim() ||
      !parsed.identifier?.trim()
    ) {
      return null;
    }
    return {
      role: parsed.role,
      name: parsed.name.trim(),
      identifier: parsed.identifier.trim(),
    };
  } catch {
    return null;
  }
}

export function currentOfficeView() {
  return cache;
}

export function subscribeOfficeView(onChange: () => void) {
  const update = () => {
    cache = readOfficeView();
    onChange();
  };
  const timer = window.setTimeout(update, 0);
  window.addEventListener(officeViewEventName, update);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener(officeViewEventName, update);
  };
}

export function openOfficeView(view: OfficeView) {
  cache = view;
  window.sessionStorage.setItem(storageKeys.officeView, JSON.stringify(view));
  window.dispatchEvent(new Event(officeViewEventName));
}

export function closeOfficeView() {
  cache = null;
  window.sessionStorage.removeItem(storageKeys.officeView);
  window.dispatchEvent(new Event(officeViewEventName));
}

const officeAction =
  /\b(approve|reject|recommend|return|submit|save|register|upload|remove|delete|allot|seal|confirm|send|update|present)\b/i;

export function isOfficeAction(label: string) {
  const text = label.replace(/\s+/g, " ").trim();
  return officeAction.test(text) || /^record\b/i.test(text);
}
