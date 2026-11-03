"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { DeskPage, DeskTabs } from "@/components/portal/Desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  checklistCatalog,
  checklistIds,
  itemId,
  loadChecklists,
  type ChecklistItem,
  type ChecklistKey,
} from "@/lib/checklists";
import { useChecklist } from "@/lib/use-checklist";
import { usePreviewSession } from "@/lib/use-preview-session";

function Editor({ listKey }: { listKey: ChecklistKey }) {
  const definition = checklistCatalog[listKey];
  const current = useChecklist(listKey);
  const session = usePreviewSession();
  const canSave = session?.role === "admin";
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = items ?? current;
  const changed = items !== null;

  const update = (index: number, patch: Partial<ChecklistItem>) =>
    setItems(shown.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  const move = (index: number, step: number) => {
    const next = [...shown];
    const [item] = next.splice(index, 1);
    next.splice(index + step, 0, item);
    setItems(next);
  };

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: listKey, items: shown }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      if (response.ok && data?.ok) {
        await loadChecklists(true);
        setItems(null);
        setMessage("Saved.");
      } else setMessage(data?.message ?? "The list could not be saved.");
    } catch {
      setMessage("Check the connection and try again.");
    }
    setBusy(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl text-primary">{definition.title}</h2>
          <p className="text-xs text-muted-foreground">Used in: {definition.usedIn}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {shown.filter((item) => item.required).length} mandatory · {shown.length} in all
        </p>
      </div>
      <ol className="space-y-2">
        {shown.map((item, index) => (
          <li
            key={`${item.id}-${index}`}
            className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-sm text-muted-foreground">{index + 1}.</span>
              <Input
                aria-label={`Item ${index + 1} title`}
                className="min-w-48 flex-1"
                value={item.title}
                maxLength={300}
                disabled={!canSave}
                onChange={(event) => update(index, { title: event.target.value })}
              />
              <label className="flex items-center gap-2 text-sm font-semibold text-primary">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={item.required}
                  disabled={!canSave}
                  onChange={(event) => update(index, { required: event.target.checked })}
                />
                Mandatory
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Move item ${index + 1} up`}
                disabled={!canSave || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Move item ${index + 1} down`}
                disabled={!canSave || index === shown.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Delete item ${index + 1}`}
                title={
                  item.locked ? "Used by the ERP; it can be made optional" : undefined
                }
                disabled={!canSave || item.locked}
                onClick={() => setItems(shown.filter((_, at) => at !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {definition.withDetail || definition.withBadge ? (
              <div className="flex flex-wrap gap-2 pl-8">
                {definition.withDetail ? (
                  <Input
                    aria-label={`Item ${index + 1} note`}
                    placeholder="Note"
                    className="min-w-48 flex-1"
                    value={item.detail ?? ""}
                    maxLength={400}
                    disabled={!canSave}
                    onChange={(event) => update(index, { detail: event.target.value })}
                  />
                ) : null}
                {definition.withBadge ? (
                  <Input
                    aria-label={`Item ${index + 1} label`}
                    placeholder="Label (e.g. Part-time)"
                    className="w-48"
                    value={item.badge ?? ""}
                    maxLength={40}
                    disabled={!canSave}
                    onChange={(event) => update(index, { badge: event.target.value })}
                  />
                ) : null}
              </div>
            ) : null}
            {definition.appliesOptions ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-8 text-xs">
                <span className="text-muted-foreground">
                  Applies to (none ticked = all):
                </span>
                {definition.appliesOptions.map((option) => {
                  const on = item.appliesTo?.includes(option) ?? false;
                  return (
                    <label key={option} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-primary"
                        checked={on}
                        disabled={!canSave}
                        onChange={() =>
                          update(index, {
                            appliesTo: on
                              ? (item.appliesTo ?? []).filter((value) => value !== option)
                              : [...(item.appliesTo ?? []), option],
                          })
                        }
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {message ? (
        <p role="status" className="text-sm text-secondary">
          {message}
        </p>
      ) : null}
      {canSave ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setItems([
                ...shown,
                {
                  id: itemId(
                    "new item",
                    shown.map((item) => item.id),
                  ),
                  title: "",
                  required: false,
                },
              ])
            }
          >
            <Plus className="size-4" /> Add item
          </Button>
          <Button
            type="button"
            variant="gold"
            disabled={!changed || busy}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save list"}
          </Button>
          {changed ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setItems(null)}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only the administrator changes checklists.
        </p>
      )}
    </section>
  );
}

/** Administration › Checklists: every checklist of the ERP, kept by the administrator. */
export function ChecklistsScreen() {
  const [tab, setTab] = useState<string>(checklistIds[0]);
  return (
    <DeskPage kicker="Administration" title="Checklists">
      <DeskTabs
        tabs={checklistIds.map((id) => ({ id, label: checklistCatalog[id].title }))}
        value={tab}
        onChange={setTab}
      />
      <Editor key={tab} listKey={tab as ChecklistKey} />
    </DeskPage>
  );
}
