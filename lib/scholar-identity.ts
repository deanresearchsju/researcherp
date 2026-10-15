import { programmeSemesters } from "@/data/doctoral";
import { university } from "@/lib/constants";
import { currentDoctoral, standingFor } from "@/lib/doctoral";
import { allocationFor, currentOffice } from "@/lib/office";
import {
  currentAllotments,
  registrationOf,
  scholarBySignIn,
  supervisorForGuide,
} from "@/lib/register";

export type IdentityPair = {
  label: string;
  value: string;
};

export type ScholarIdentity = {
  name: string;
  registerNo: string;
  studentId: string;
  email: string;
  institution: string;
  program: string;
  semester: string;
  studyMode: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorDetails: string;
  school: string;
  pairs: [IdentityPair, IdentityPair][];
};

const romanMarks = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
] as const;

export function formatSemester(value: number) {
  const mark = romanMarks[value - 1];
  return mark ? `${mark} Semester` : `Semester ${value}`;
}

export function scholarSemesterNumber(identifier: string) {
  const doctoral = currentDoctoral();
  const standing = standingFor(doctoral?.standings ?? [], identifier);
  if (
    standing &&
    programmeSemesters.includes(standing.semester as (typeof programmeSemesters)[number])
  ) {
    return standing.semester;
  }
  const semesters =
    doctoral?.registrations
      .filter((item) => item.scholarIdentifier.toLowerCase() === identifier.toLowerCase())
      .map((item) => item.semester) ?? [];
  return semesters.length > 0 ? Math.max(...semesters) : 0;
}

export function scholarSemesterLabel(identifier: string) {
  const value = scholarSemesterNumber(identifier);
  return value ? formatSemester(value) : "—";
}

export function scholarIdentity(identifier: string): ScholarIdentity {
  const scholar = scholarBySignIn(identifier);
  const allotments = currentAllotments();
  const doctoral = currentDoctoral();
  const office = currentOffice();
  const allocation = allocationFor(office?.allocations ?? [], identifier);
  const registerGuide = scholar ? supervisorForGuide(scholar.guideName) : null;
  const enrollment = doctoral?.enrollments.find(
    (item) => item.scholarIdentifier.toLowerCase() === identifier.toLowerCase(),
  );
  const supervisorName =
    allocation?.supervisorName.trim() ||
    registerGuide?.name.trim() ||
    scholar?.guideName.trim() ||
    "—";
  const supervisorEmail = registerGuide?.email.trim() || "";
  const supervisorDetails = [
    supervisorName,
    registerGuide?.designation.trim(),
    registerGuide?.department.trim(),
    supervisorEmail ? `Email: ${supervisorEmail}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const program = scholar?.department.trim()
    ? `Ph.D. — ${scholar.department.trim()}`
    : "Ph.D.";
  const name = scholar?.name.trim() || "—";
  const registerNo = scholar ? registrationOf(scholar, allotments) || "—" : "—";
  const studentId = scholar?.fileNumber.trim() || "—";
  const email = scholar?.email.trim() || (identifier.includes("@") ? identifier : "—");
  const institution = scholar?.institution.trim() || university.name;
  const semester = scholarSemesterLabel(identifier);
  const studyMode = enrollment?.studyMode.trim() || scholar?.category.trim() || "—";
  const school = enrollment?.school.trim() || "—";

  return {
    name,
    registerNo,
    studentId,
    email,
    institution,
    program,
    semester,
    studyMode,
    supervisorName,
    supervisorEmail,
    supervisorDetails: supervisorDetails || "—",
    school,
    pairs: [
      [
        { label: "Student Name", value: name },
        { label: "Register No.", value: registerNo },
      ],
      [
        { label: "Institution", value: institution },
        { label: "Program", value: program },
      ],
      [
        { label: "Semester", value: semester },
        { label: "Supervisor Details", value: supervisorDetails || "—" },
      ],
    ],
  };
}
