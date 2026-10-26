import { redirect } from "next/navigation";

/** Examiner reports are for the research office only; a scholar is sent to the dashboard. */
export default function ScholarExaminerReportsPage() {
  redirect("/scholar/dashboard");
}
