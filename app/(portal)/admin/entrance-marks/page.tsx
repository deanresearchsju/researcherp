import { redirect } from "next/navigation";

/** Entrance marks are entered at step 4 of Selection. */
export default function EntranceMarksPage() {
  redirect("/admin/admission");
}
