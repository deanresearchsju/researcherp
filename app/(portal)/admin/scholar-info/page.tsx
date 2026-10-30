import { redirect } from "next/navigation";

// Scholar information is now a part of the Scholar register.
export default function Page() {
  redirect("/admin/register?tab=entry");
}
