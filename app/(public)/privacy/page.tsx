import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/container";
import { pageHeroes } from "@/data/page-heroes";
import { university } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy",
  description: `How ${university.name} handles the personal information given on the research portal.`,
  alternates: { canonical: "/privacy" },
};

const sections: { title: string; body: string[] }[] = [
  {
    title: "What we collect",
    body: [
      "When you apply for the Ph.D. or for recognition as a supervisor we collect the details on the application form: your name, date of birth, contact details, address, education, work experience, your photograph and signature, and the documents you upload, such as certificates and the fee receipt.",
      "After admission the research office keeps your academic record: course work and examination results, committee reports, reports, publications, fee payments, requests and the decisions taken on them.",
      "If you write to the helpdesk we keep your message and the contact details you give.",
    ],
  },
  {
    title: "Why we collect it",
    body: [
      "To process your application, run the selection, admit you, guide and examine you, and keep the record that the University and the University Grants Commission require. We do not use it for advertising and we do not sell it.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "The research office, the Dean and the Vice Chancellor see what their work needs. Accounts sees fee payments, and the Controller of Examinations sees examination records. Your supervisor sees your academic record and the requests you make. Other scholars cannot see your information.",
      "Some information is public by design: the names, designations and research areas of recognised supervisors on the Supervisors page, and the application status, which is shown only to someone who has the application number and the date of birth.",
    ],
  },
  {
    title: "Where it is kept and how it is protected",
    body: [
      "Records are kept with cloud service providers (a managed database, and storage for uploaded documents). Sign-in passwords are stored in a scrambled form. Uploaded documents are not public: they open only for a signed-in member of the University and through a link that stops working after a few minutes.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "Admission and academic records are kept for as long as the University needs them for the degree, for audit and for the rules that apply to it. Applications that are not selected are moved to an archive.",
    ],
  },
  {
    title: "Cookies and your browser",
    body: [
      "The portal uses one sign-in cookie, only after you sign in. Your browser also keeps a draft of an application you have started so that you can finish it later; clear your browser data to remove it. We do not use advertising or tracking cookies.",
    ],
  },
  {
    title: "Your choices",
    body: [
      `You may ask the research office to show you the information held about you, or to correct it, by writing to ${university.email} and quoting your application or registration number.`,
    ],
  },
];

export default function PrivacyPage() {
  const copy = pageHeroes.privacy;
  return (
    <>
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} summary={copy.summary} />
      <Container className="max-w-3xl space-y-8 py-8 sm:py-10">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-heading text-xl font-semibold text-primary">
              {section.title}
            </h2>
            {section.body.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-2 text-justify text-sm leading-7 text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </Container>
    </>
  );
}
