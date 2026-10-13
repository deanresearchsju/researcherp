import { storageKeys } from "@/lib/constants";
import { createSupabase } from "@/lib/supabase/client";
import { toJson } from "@/lib/records";

export type ThesisPanel = {
  thesisId: string;
  selectedLocal: string;
  selectedIndian: string;
  selectedForeign: string;
};

let memory: ThesisPanel[] | null = null;
let loading = false;
const listeners = new Set<() => void>();

function parse(value: unknown): ThesisPanel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<ThesisPanel>;
    if (!row.thesisId) return [];
    return [
      {
        thesisId: row.thesisId,
        selectedLocal: row.selectedLocal ?? "",
        selectedIndian: row.selectedIndian ?? "",
        selectedForeign: row.selectedForeign ?? "",
      },
    ];
  });
}

function readBrowser() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKeys.thesisPanels);
    return raw ? parse(JSON.parse(raw) as unknown) : [];
  } catch {
    return [];
  }
}

function publish(next: ThesisPanel[]) {
  memory = next;
  listeners.forEach((listener) => listener());
}

export function currentPanels() {
  return memory;
}

export function subscribePanels(onChange: () => void) {
  listeners.add(onChange);
  if (!loading) {
    loading = true;
    void loadPanels().then((value) => {
      loading = false;
      publish(value);
    });
  }
  return () => listeners.delete(onChange);
}

async function loadPanels() {
  const browser = readBrowser();
  const supabase = createSupabase();
  if (!supabase) return browser;
  const { data, error } = await supabase
    .from("thesis_panels")
    .select("payload")
    .eq("id", "office")
    .maybeSingle();
  if (error || !data?.payload) return browser;
  const remote = parse(data.payload);
  const seen = new Set(remote.map((item) => item.thesisId));
  return [...browser.filter((item) => !seen.has(item.thesisId)), ...remote];
}

export async function savePanel(panel: ThesisPanel) {
  const next = (memory ?? readBrowser()).filter(
    (item) => item.thesisId !== panel.thesisId,
  );
  next.unshift(panel);
  const supabase = createSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("thesis_panels")
      .upsert({ id: "office", payload: toJson(next) });
    if (!error) {
      publish(next);
      return;
    }
  }
  window.localStorage.setItem(storageKeys.thesisPanels, JSON.stringify(next));
  publish(next);
}
