"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useSyncExternalStore } from "react";
import { z } from "zod";

import { ListToolbar, textMatches } from "@/components/portal/ListToolbar";
import { PersonNameLink } from "@/components/portal/PersonNameLink";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { programmeSemesters } from "@/data/doctoral";
import { officeActionCopy } from "@/data/office-actions";
import { researchRegister } from "@/data/research-register";
import { currentDoctoral, promoteScholars, subscribeDoctoral } from "@/lib/doctoral";
import {
  batchOf,
  currentAllotments,
  registrationOf,
  scholarSignInId,
  subscribeRegister,
} from "@/lib/register";
import { formatSemester, scholarSemesterLabel } from "@/lib/scholar-identity";

const copy = officeActionCopy.promotion;

const promotionSchema = z.object({
  batchId: z.string().min(1, "Select a batch."),
  semester: z
    .string()
    .min(1, "Select the semester.")
    .refine(
      (value) => programmeSemesters.some((item) => String(item) === value),
      "Select the semester.",
    ),
  scholarIds: z.array(z.string()).min(1, "Select at least one scholar."),
});

type PromotionValues = z.infer<typeof promotionSchema>;

export function SemesterPromotionScreen() {
  const doctoral = useSyncExternalStore(subscribeDoctoral, currentDoctoral, () => null);
  const allotments = useSyncExternalStore(
    subscribeRegister,
    currentAllotments,
    currentAllotments,
  );
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<PromotionValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: { batchId: "", semester: "", scholarIds: [] },
  });
  const batchId = useWatch({ control: form.control, name: "batchId" }) ?? "";
  const semester = useWatch({ control: form.control, name: "semester" }) ?? "";
  const selectedIds = useWatch({ control: form.control, name: "scholarIds" }) ?? [];

  const batches = useMemo(
    () => [...researchRegister.batches].sort((left, right) => left.order - right.order),
    [],
  );

  const rows = useMemo(() => {
    return researchRegister.scholars
      .filter((scholar) => scholar.batchId === batchId)
      .map((scholar) => {
        const identifier = scholarSignInId(scholar);
        return {
          identifier,
          name: scholar.name,
          department: scholar.department,
          registration: registrationOf(scholar, allotments) || scholar.applicationNumber,
          currentLabel: scholarSemesterLabel(identifier),
        };
      });
  }, [allotments, batchId, doctoral]);

  const listed = rows.filter((row) =>
    textMatches(query, [row.name, row.identifier, row.registration, row.department]),
  );

  function toggleScholar(identifier: string) {
    const next = selectedIds.includes(identifier)
      ? selectedIds.filter((item) => item !== identifier)
      : [...selectedIds, identifier];
    form.setValue("scholarIds", next, { shouldValidate: true });
  }

  function toggleAll() {
    const ids = listed.map((row) => row.identifier);
    const allOn = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    form.setValue("scholarIds", allOn ? [] : ids, { shouldValidate: true });
  }

  async function onSubmit(values: PromotionValues, direction: "promote" | "demote") {
    const chosen = rows.filter((row) => values.scholarIds.includes(row.identifier));
    const target = Number(values.semester);
    setBusy(true);
    setNotice(null);
    const saved = await promoteScholars({
      batchId: values.batchId,
      semester: target,
      scholars: chosen.map((row) => ({ identifier: row.identifier, name: row.name })),
      direction,
    });
    setBusy(false);
    if (!saved.ok) {
      setNotice(saved.message);
      return;
    }
    form.setValue("scholarIds", []);
    const batch = batchOf(values.batchId);
    const mapped =
      saved.moved === 1 && chosen.length === 1
        ? `${chosen[0].name} is mapped to ${formatSemester(target)}${batch ? ` · ${batch.name}` : ""}.`
        : `${saved.moved} scholars are mapped to ${formatSemester(target)}${batch ? ` · ${batch.name}` : ""}.`;
    setNotice(
      saved.skipped > 0
        ? `${mapped} ${saved.skipped} could not move in that direction.`
        : mapped,
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-secondary uppercase">
        {copy.kicker}
      </p>
      <h1 className="mt-2 font-heading text-4xl text-primary">{copy.title}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
        {copy.detail}
      </p>
      {doctoral?.detail ? (
        <p className="mt-4 text-sm leading-6 text-secondary">{doctoral.detail}</p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-secondary">
          {notice}
        </p>
      ) : null}
      <form
        className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField
          label={copy.batchLabel}
          htmlFor="promote-batch"
          required
          error={form.formState.errors.batchId?.message}
        >
          <NativeSelect
            id="promote-batch"
            value={batchId}
            onChange={(event) => {
              form.setValue("batchId", event.target.value, { shouldValidate: true });
              form.setValue("scholarIds", []);
            }}
          >
            <option value="">Select a batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField
          label={copy.semesterLabel}
          htmlFor="promote-semester"
          required
          error={form.formState.errors.semester?.message}
        >
          <NativeSelect
            id="promote-semester"
            value={semester}
            onChange={(event) =>
              form.setValue("semester", event.target.value, { shouldValidate: true })
            }
          >
            <option value="">Select a semester</option>
            {programmeSemesters.map((item) => (
              <option key={item} value={String(item)}>
                {formatSemester(item)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="gold"
            disabled={busy || !batchId}
            onClick={() =>
              void form.handleSubmit((values) => onSubmit(values, "promote"))()
            }
          >
            {copy.promote}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !batchId}
            onClick={() =>
              void form.handleSubmit((values) => onSubmit(values, "demote"))()
            }
          >
            {copy.demote}
          </Button>
          {form.formState.errors.scholarIds?.message ? (
            <p className="mt-2 w-full text-sm text-secondary">
              {form.formState.errors.scholarIds.message}
            </p>
          ) : null}
        </div>
      </form>
      {!batchId ? (
        <p className="mt-6 text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <>
          <ListToolbar
            query={query}
            onQuery={setQuery}
            filters={[]}
            shown={listed.length}
            total={rows.length}
            filename="semester-promotion.csv"
            headers={["scholar_name", "identifier", "current_semester"]}
            rows={listed.map((row) => [row.name, row.identifier, row.currentLabel])}
          />
          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead className="bg-muted text-primary">
                <tr>
                  <th className="px-3 py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          listed.length > 0 &&
                          listed.every((row) => selectedIds.includes(row.identifier))
                        }
                        onChange={toggleAll}
                      />
                      <span className="sr-only">Select all</span>
                    </label>
                  </th>
                  <th className="px-3 py-3">Scholar</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Current semester</th>
                </tr>
              </thead>
              <tbody>
                {listed.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={4}>
                      No scholar is on that batch.
                    </td>
                  </tr>
                ) : (
                  listed.map((row) => (
                    <tr key={row.identifier} className="border-t border-border">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.identifier)}
                          onChange={() => toggleScholar(row.identifier)}
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-primary">
                          <PersonNameLink
                            role="scholar"
                            name={row.name}
                            identifier={row.identifier}
                          />
                        </p>
                        <p className="text-muted-foreground">{row.registration}</p>
                      </td>
                      <td className="px-3 py-3">{row.department || "—"}</td>
                      <td className="px-3 py-3">{row.currentLabel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
