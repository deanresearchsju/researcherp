import Link from "next/link";

/** Courteous notice shown to prospective Ph.D. applicants before they apply. */
export function ApplicantAlert({ className = "" }: { className?: string }) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm leading-6 text-secondary ${className}`}
    >
      <p className="font-semibold">A kind note to prospective applicants</p>
      <p className="mt-1">
        Before applying, please check the availability of supervisor vacancies for your
        subject on the{" "}
        <Link href="/supervisors" className="font-semibold underline">
          Supervisors page
        </Link>
        . Kindly note that the application fee, once paid, is non-refundable.
      </p>
    </div>
  );
}
