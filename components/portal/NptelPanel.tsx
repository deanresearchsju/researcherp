"use client";

import { useState } from "react";

import { FileUpload } from "@/components/forms/FileUpload";
import {
  DeskSection,
  DeskTable,
  FormDialog,
  ViewFilesButton,
} from "@/components/portal/Desk";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { nptelCopy, nptelKinds, nptelMax, type NptelKind } from "@/data/doctoral";
import { months } from "@/lib/constants";
import { formatIsoDate } from "@/lib/dates";
import {
  addNptel,
  completeNptel,
  decideNptel,
  nptelOf,
  nptelProblem,
  removeNptel,
  type DoctoralState,
  type NptelCourse,
} from "@/lib/doctoral";
import { storeFile } from "@/lib/file-store";
import { fileError, type StoredFile } from "@/lib/files";
import { usePreviewSession } from "@/lib/use-preview-session";

const tone = {
  "In progress": "outline",
  Submitted: "purple",
  Approved: "gold",
  Rejected: "maroon",
} as const;

const approvalText = {
  "In progress": "In progress",
  Submitted: "Waiting for the Dean",
  Approved: "Approved · exempt from the paper",
  Rejected: "Turned down",
} as const;

function passedOn(course: Pick<NptelCourse, "passMonth" | "passYear">) {
  return [course.passMonth, course.passYear].filter(Boolean).join(" ") || "—";
}

const thisYear = new Date().getFullYear();

function PassFields({
  month,
  year,
  onMonth,
  onYear,
  required,
  idPrefix,
}: {
  month: string;
  year: string;
  onMonth: (value: string) => void;
  onYear: (value: string) => void;
  required: boolean;
  idPrefix: string;
}) {
  return (
    <>
      <FormField
        label="Month of the pass"
        htmlFor={`${idPrefix}-month`}
        required={required}
      >
        <NativeSelect
          id={`${idPrefix}-month`}
          value={month}
          onChange={(event) => onMonth(event.target.value)}
        >
          <option value="">Choose…</option>
          {months.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label="Year of the pass"
        htmlFor={`${idPrefix}-year`}
        required={required}
      >
        <Input
          id={`${idPrefix}-year`}
          inputMode="numeric"
          maxLength={4}
          placeholder={String(thisYear)}
          value={year}
          onChange={(event) => onYear(event.target.value.replace(/\D/g, ""))}
        />
      </FormField>
    </>
  );
}

function AddDialog({
  identifier,
  scholarName,
  existing,
  onClose,
  onDone,
}: {
  identifier: string;
  scholarName: string;
  existing: readonly NptelCourse[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const used = new Set(existing.map((item) => item.kind));
  const [kind, setKind] = useState<NptelKind | "">("");
  const [semester, setSemester] = useState("");
  const [racApproved, setRacApproved] = useState<boolean | null>(null);
  const [minutes, setMinutes] = useState<StoredFile | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [credit, setCredit] = useState("");
  const [status, setStatus] = useState<"Passed" | "In progress">("In progress");
  const [passMonth, setPassMonth] = useState("");
  const [passYear, setPassYear] = useState("");
  const [proof, setProof] = useState<StoredFile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      semester: Number(semester),
      kind: kind as NptelKind,
      subjectName,
      credit,
      status,
      passMonth,
      passYear,
      racApproved,
      hasRacMinutes: Boolean(minutes?.file),
      hasProof: Boolean(proof?.file),
    };
    const problem = nptelProblem(input, existing);
    if (problem) return setError(problem);
    const minutesProblem = fileError(minutes?.file ?? null, "pdfDocument", true);
    if (minutesProblem || !minutes?.file)
      return setError(minutesProblem ?? "Attach the minutes.");
    if (status === "Passed") {
      const proofProblem = fileError(proof?.file ?? null, "pdfDocument", true);
      if (proofProblem || !proof?.file)
        return setError(proofProblem ?? "Attach the proof.");
    }
    setBusy(true);
    const minutesData = await storeFile(minutes.file, "records").catch(() => "");
    const proofData =
      status === "Passed" && proof?.file
        ? await storeFile(proof.file, "records").catch(() => "")
        : "";
    const saved = await addNptel({
      ...input,
      scholarIdentifier: identifier,
      scholarName,
      racMinutesName: minutes.file.name,
      racMinutesData: minutesData || null,
      proofName: proof?.file.name ?? "",
      proofData: proofData || null,
    });
    setBusy(false);
    if (!saved.ok) return setError(saved.message);
    onDone(
      status === "Passed"
        ? "The NPTEL course is added. The proof of passing waits for the Dean."
        : "The NPTEL course is added. When you pass, attach the proof here.",
    );
  }

  return (
    <FormDialog
      title="Add an NPTEL course"
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Save"
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Paper taken as an NPTEL course" htmlFor="nptel-kind" required>
          <NativeSelect
            id="nptel-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as NptelKind | "")}
          >
            <option value="">Choose…</option>
            {nptelKinds.map((item) => (
              <option key={item} value={item} disabled={used.has(item)}>
                {item}
                {used.has(item) ? " (taken)" : ""}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Semester" htmlFor="nptel-semester" required>
          <NativeSelect
            id="nptel-semester"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
          >
            <option value="">Choose…</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
          </NativeSelect>
        </FormField>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-semibold text-primary">
            {nptelCopy.racQuestion}
          </legend>
          <div className="mt-2 flex gap-6 text-sm">
            {[
              ["Yes", true],
              ["No", false],
            ].map(([label, value]) => (
              <label key={String(label)} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="nptel-rac"
                  checked={racApproved === value}
                  onChange={() => setRacApproved(value as boolean)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {racApproved === false ? (
          <p
            role="alert"
            className="rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm font-semibold text-secondary sm:col-span-2"
          >
            {nptelCopy.racNo}
          </p>
        ) : null}
        {racApproved ? (
          <>
            <FormField
              label="Minutes of the RAC that approved the course"
              htmlFor="nptel-minutes"
              required
              className="sm:col-span-2"
            >
              <FileUpload
                id="nptel-minutes"
                acceptRule="pdfDocument"
                value={minutes}
                onChange={setMinutes}
              />
            </FormField>
            <FormField label="NPTEL subject name" htmlFor="nptel-subject" required>
              <Input
                id="nptel-subject"
                value={subjectName}
                maxLength={150}
                onChange={(event) => setSubjectName(event.target.value)}
              />
            </FormField>
            <FormField label="Credit" htmlFor="nptel-credit" required>
              <Input
                id="nptel-credit"
                inputMode="decimal"
                maxLength={4}
                value={credit}
                onChange={(event) =>
                  setCredit(event.target.value.replace(/[^0-9.]/g, ""))
                }
              />
            </FormField>
            <FormField label="Passed or in progress" htmlFor="nptel-status" required>
              <NativeSelect
                id="nptel-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "Passed" | "In progress")
                }
              >
                <option value="In progress">In progress</option>
                <option value="Passed">Passed</option>
              </NativeSelect>
            </FormField>
            <div className="hidden sm:block" />
            <PassFields
              idPrefix="nptel"
              month={passMonth}
              year={passYear}
              onMonth={setPassMonth}
              onYear={setPassYear}
              required={status === "Passed"}
            />
            {status === "Passed" ? (
              <FormField
                label="Proof of passing (the NPTEL certificate)"
                htmlFor="nptel-proof"
                required
                className="sm:col-span-2"
              >
                <FileUpload
                  id="nptel-proof"
                  acceptRule="pdfDocument"
                  value={proof}
                  onChange={setProof}
                />
              </FormField>
            ) : null}
          </>
        ) : null}
        {error && racApproved !== false ? (
          <p role="alert" className="text-sm text-secondary sm:col-span-2">
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}

function ProofDialog({
  course,
  onClose,
  onDone,
}: {
  course: NptelCourse;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [month, setMonth] = useState(course.passMonth);
  const [year, setYear] = useState(course.passYear);
  const [proof, setProof] = useState<StoredFile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = fileError(proof?.file ?? null, "pdfDocument", true);
    if (problem || !proof?.file)
      return setError(problem ?? "Attach the proof of passing.");
    setBusy(true);
    const data = await storeFile(proof.file, "records").catch(() => "");
    const saved = await completeNptel(course.id, {
      passMonth: month,
      passYear: year,
      proofName: proof.file.name,
      proofData: data || null,
    });
    setBusy(false);
    if (!saved.ok) return setError(saved.message);
    onDone("The proof of passing waits for the Dean.");
  }

  return (
    <FormDialog
      title={`Proof of passing · ${course.subjectName}`}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
      busy={busy}
      submitLabel="Send to the Dean"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PassFields
          idPrefix="proof"
          month={month}
          year={year}
          onMonth={setMonth}
          onYear={setYear}
          required
        />
        <FormField
          label="Proof of passing (the NPTEL certificate)"
          htmlFor="proof-file"
          required
          className="sm:col-span-2"
        >
          <FileUpload
            id="proof-file"
            acceptRule="pdfDocument"
            value={proof}
            onChange={setProof}
          />
        </FormField>
        {error ? (
          <p role="alert" className="text-sm text-secondary sm:col-span-2">
            {error}
          </p>
        ) : null}
      </div>
    </FormDialog>
  );
}

function Files({
  course,
  onMissing,
}: {
  course: NptelCourse;
  onMissing: (m: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ViewFilesButton
        fileName={course.racMinutesName}
        data={course.racMinutesData}
        onMissing={onMissing}
      />
      <ViewFilesButton
        fileName={course.proofName}
        data={course.proofData}
        onMissing={onMissing}
      />
    </div>
  );
}

/** The scholar's NPTEL courses: add one, attach the proof of passing, follow the Dean's decision. */
export function ScholarNptel({
  doctoral,
  identifier,
  scholarName,
}: {
  doctoral: DoctoralState;
  identifier: string;
  scholarName: string;
}) {
  const mine = nptelOf(doctoral, identifier);
  const [adding, setAdding] = useState(false);
  const [proving, setProving] = useState<NptelCourse | null>(null);
  const [notice, setNotice] = useState("");

  return (
    <DeskSection title="NPTEL courses">
      <div className="space-y-3 p-4">
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {nptelCopy.rules}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-primary">
            {mine.length} of {nptelMax} NPTEL courses taken
          </p>
          <Button
            type="button"
            variant="gold"
            size="sm"
            disabled={mine.length >= nptelMax}
            onClick={() => {
              setNotice("");
              setAdding(true);
            }}
          >
            Add an NPTEL course
          </Button>
        </div>
        {notice ? (
          <p role="status" className="text-sm font-medium text-secondary">
            {notice}
          </p>
        ) : null}
      </div>
      <DeskTable
        headers={[
          "Paper",
          "Semester",
          "NPTEL subject",
          "Credit",
          "Passed on",
          "Status",
          "",
        ]}
        empty={mine.length === 0}
      >
        {mine.map((course) => (
          <tr key={course.id} className="border-t border-border align-top">
            <td className="px-4 py-3 font-semibold text-primary">{course.kind}</td>
            <td className="px-4 py-3">{course.semester}</td>
            <td className="px-4 py-3">{course.subjectName}</td>
            <td className="px-4 py-3">{course.credit}</td>
            <td className="px-4 py-3">
              {passedOn(course)}
              {course.status === "In progress" ? (
                <span className="block text-xs text-muted-foreground">in progress</span>
              ) : null}
            </td>
            <td className="px-4 py-3">
              <Badge variant={tone[course.approval]}>
                {approvalText[course.approval]}
              </Badge>
              {course.remarks ? (
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {course.remarks}
                </p>
              ) : null}
            </td>
            <td className="px-4 py-3">
              <Files course={course} onMissing={setNotice} />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {course.approval === "In progress" ? (
                  <Button type="button" size="sm" onClick={() => setProving(course)}>
                    Add proof of passing
                  </Button>
                ) : null}
                {course.approval !== "Approved" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void removeNptel(course.id).then((saved) =>
                        setNotice(
                          saved.ok ? "The NPTEL course is removed." : saved.message,
                        ),
                      )
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </DeskTable>
      {adding ? (
        <AddDialog
          identifier={identifier}
          scholarName={scholarName}
          existing={mine}
          onClose={() => setAdding(false)}
          onDone={(message) => {
            setAdding(false);
            setNotice(message);
          }}
        />
      ) : null}
      {proving ? (
        <ProofDialog
          course={proving}
          onClose={() => setProving(null)}
          onDone={(message) => {
            setProving(null);
            setNotice(message);
          }}
        />
      ) : null}
    </DeskSection>
  );
}

/** For the research office: every NPTEL course; the Dean (or the administrator) approves the proofs. */
export function NptelApprovals({ doctoral }: { doctoral: DoctoralState }) {
  const session = usePreviewSession();
  const canDecide = session?.role === "dean" || session?.role === "admin";
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [show, setShow] = useState<"waiting" | "all">("waiting");
  const all = [...(doctoral.nptel ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const rows =
    show === "waiting" ? all.filter((item) => item.approval === "Submitted") : all;

  async function decide(course: NptelCourse, status: "Approved" | "Rejected") {
    const saved = await decideNptel(course.id, {
      status,
      remarks: remarks[course.id] ?? "",
    });
    setNotice(saved.ok ? `The course is ${status.toLowerCase()}.` : saved.message);
  }

  return (
    <DeskSection title="NPTEL courses">
      <div className="space-y-3 p-4">
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Scholars take up to two of their four course-work papers as NPTEL courses, with
          the RAC&apos;s approval (the minutes are attached). The Dean approves the proof
          of passing; the scholar is then exempt from appearing for that paper.
          {canDecide ? "" : " The Dean decides; you can read them here."}
        </p>
        <div className="flex gap-2">
          {(
            [
              [
                "waiting",
                `Waiting for the Dean (${all.filter((i) => i.approval === "Submitted").length})`,
              ],
              ["all", `All (${all.length})`],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={show === id ? "default" : "outline"}
              onClick={() => setShow(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        {notice ? (
          <p role="status" className="text-sm font-medium text-secondary">
            {notice}
          </p>
        ) : null}
      </div>
      <DeskTable
        headers={[
          "Scholar",
          "Paper",
          "Sem.",
          "NPTEL subject",
          "Credit",
          "Passed on",
          "Status",
          "",
        ]}
        empty={rows.length === 0}
      >
        {rows.map((course) => (
          <tr key={course.id} className="border-t border-border align-top">
            <td className="px-4 py-3 font-semibold text-primary">{course.scholarName}</td>
            <td className="px-4 py-3">{course.kind}</td>
            <td className="px-4 py-3">{course.semester}</td>
            <td className="px-4 py-3">{course.subjectName}</td>
            <td className="px-4 py-3">{course.credit}</td>
            <td className="px-4 py-3">{passedOn(course)}</td>
            <td className="px-4 py-3">
              <Badge variant={tone[course.approval]}>
                {approvalText[course.approval]}
              </Badge>
              {course.decidedBy ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {course.decidedBy},{" "}
                  {course.decidedOn ? formatIsoDate(course.decidedOn) : ""}
                </p>
              ) : null}
              {course.remarks ? (
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {course.remarks}
                </p>
              ) : null}
            </td>
            <td className="px-4 py-3">
              <Files course={course} onMissing={setNotice} />
              {course.approval === "Submitted" && canDecide ? (
                <div className="mt-2 grid gap-2">
                  <Textarea
                    rows={2}
                    aria-label="Remarks"
                    placeholder="Remarks (needed to turn it down)"
                    value={remarks[course.id] ?? ""}
                    onChange={(event) =>
                      setRemarks((current) => ({
                        ...current,
                        [course.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void decide(course, "Approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void decide(course, "Rejected")}
                    >
                      Turn down
                    </Button>
                  </div>
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </DeskTable>
    </DeskSection>
  );
}
