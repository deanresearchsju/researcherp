/**
 * The sections (tabs) inside a menu that the administrator can open or close for a sign-in, one
 * level below the menu and its Add / edit, Approve, Export and Upload rights. A screen's tab ids
 * must match the ids here.
 */
export type MenuSection = { id: string; label: string };

export const menuSections: Record<string, readonly MenuSection[]> = {
  "/admin/course-work": [
    { id: "registrations", label: "Registrations & COE" },
    { id: "arrears", label: "Arrears" },
    { id: "subjects", label: "Subjects" },
  ],
  "/admin/exam-setup": [
    { id: "campuses", label: "Exam campuses" },
    { id: "timetable", label: "Timetable" },
    { id: "marks", label: "Marks & grades" },
  ],
  "/admin/exam-tickets": [
    { id: "tickets", label: "Hall tickets" },
    { id: "seating", label: "Seating plan" },
    { id: "attendance", label: "Attendance" },
  ],
  "/admin/invigilation": [
    { id: "plan", label: "Duty plan" },
    { id: "pool", label: "Invigilators" },
    { id: "list", label: "Date-wise list" },
    { id: "consolidated", label: "Consolidated list" },
    { id: "letters", label: "Letters and orders" },
  ],
  "/admin/entrance-invigilation": [
    { id: "plan", label: "Duty plan" },
    { id: "pool", label: "Invigilators" },
    { id: "list", label: "Date-wise list" },
    { id: "consolidated", label: "Consolidated list" },
    { id: "letters", label: "Letters and orders" },
  ],
  "/admin/payments": [
    { id: "registration", label: "Registration fee" },
    { id: "course-work", label: "Course-work fee" },
    { id: "annual", label: "Annual fee" },
    { id: "synopsis", label: "Synopsis fee" },
    { id: "thesis", label: "Thesis fee" },
  ],
  "/admin/fee": [
    { id: "ledger", label: "Fee ledger" },
    { id: "verify", label: "Verify payments" },
    { id: "reminders", label: "Reminders" },
  ],
  "/admin/supervisors": [
    { id: "active", label: "Active supervisors" },
    { id: "inactive", label: "Inactive supervisors" },
  ],
  "/admin/supervisor-exit": [
    { id: "leaving", label: "Leaving" },
    { id: "past", label: "Past supervisors" },
  ],
  "/admin/passed-out": [
    { id: "ready", label: "Viva passed" },
    { id: "passed", label: "Passed out" },
  ],
  "/admin/plagiarism": [
    { id: "synopsis", label: "Before synopsis" },
    { id: "thesis", label: "Before thesis" },
  ],
  "/admin/colloquium": [
    { id: "events", label: "Events" },
    { id: "scholars", label: "Scholar-wise" },
    { id: "supervisors", label: "Supervisor-wise" },
    { id: "batches", label: "Batch-wise" },
  ],
  "/admin/results": [
    { id: "grades", label: "Grade / mark" },
    { id: "failed", label: "RA courses" },
    { id: "absent", label: "Absent details" },
    { id: "history", label: "History" },
  ],
};
