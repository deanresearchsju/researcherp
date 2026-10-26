import Link from "next/link";

/** Courteous notice shown to prospective Ph.D. applicants before they apply. */
export function ApplicantAlert({ className = "" }: { className?: string }) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm leading-6 text-secondary ${className}`}
    >
      <p className="font-semibold">A kind note to prospective applicants</p>
      <p className="mt-1 text-justify">
        The application accepts only departments that have a supervisor vacancy in the
        current session; you are told as soon as you choose your school and department.
        You may read about our{" "}
        <Link href="/supervisors" className="font-semibold underline">
          research supervisors
        </Link>{" "}
        and their areas of research before you apply. Kindly note that the application
        fee, once paid, is non-refundable.
      </p>
    </div>
  );
}
