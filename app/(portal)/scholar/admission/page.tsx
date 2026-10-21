import { redirect } from "next/navigation";

/** The admission application is shown on the scholar dashboard. */
export default function ScholarAdmissionPage() {
  redirect("/scholar/dashboard#admission");
}
