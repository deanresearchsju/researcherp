# The public website

For the Research Office: what the public sees, and how to change it without a programmer when possible.

## The pages

| Address                                               | What it shows                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                   | The hero, announcements, **the Ph.D. under the UGC Regulations, 2022**, support for scholars (DrillBit, stipend, IRINS), research areas |
| `/admission`                                          | The four-step process, the study modes, the documents to prepare, the questions                                                         |
| `/supervisors`                                        | The recognised supervisors with areas of research and the Vidwan link, and a search box                                                 |
| `/announcements`                                      | Notices and events                                                                                                                      |
| `/our-team`                                           | The Dean and the Research Office                                                                                                        |
| `/downloads`                                          | Forms and regulations                                                                                                                   |
| `/apply`, `/apply/status`                             | The online Ph.D. application and the status look-up (application number and date of birth)                                              |
| `/supervisor-recognition/apply`, `/status`            | The supervisor recognition application and its status                                                                                   |
| `/terms`, `/privacy`                                  | Terms and the privacy statement                                                                                                         |
| `/login/scholar`, `/login/supervisor`, `/login/admin` | Sign-in (not shown to search engines)                                                                                                   |

Old addresses (`/supervisor-vacancy`, `/programmes`, `/research-areas`, `/scholar-journey`) lead to the pages that replaced them.

## What changes by itself

| Shown on the website                                       | Comes from (in the ERP)                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| "Admission window will be open soon" or the apply link     | Admissions, **Application window** (the switch and the session)                                 |
| Which schools and departments an applicant can choose      | Website, **Research areas**                                                                     |
| The key research areas under each department               | The **Supervisor register** (area of research of active supervisors)                            |
| The supervisor profiles                                    | Website, **Supervisor profiles** (photo, biography, area, Vidwan ID, "show on the public page") |
| Announcements and events                                   | Website, **News and events**                                                                    |
| The team                                                   | Website, **Our Team**                                                                           |
| The fees shown                                             | Administration, **Fee settings**                                                                |
| Downloads                                                  | Letters & reports, **Forms & formats**                                                          |
| Whether a department has a vacancy (told to the applicant) | Worked out from the supervisor register: quota less the scholars each active supervisor guides  |

The vacancy list itself is **not** shown to the public.

## What is changed in the code files (ask the programmer, or follow the steps)

Text and lists live in the `data` folder, not in the page code. Open the file in any text editor, change the words between the quotation marks, save, and publish (see DEPLOYMENT).

| File                                      | What it controls                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `data/ugc-norms.ts`                       | The UGC section of the home page (eligibility, selection, stages, duration, supervision)     |
| `data/research-support.ts`                | DrillBit, stipend (put the amount in `amount`) and IRINS                                     |
| `data/research-home.ts`                   | The study modes (full time, part-time) shown on the Admission page                           |
| `data/admission.ts`                       | The admission steps and headings                                                             |
| `data/checklist.ts`                       | The documents to prepare                                                                     |
| `data/faqs.ts`                            | The questions on the Admission page                                                          |
| `data/sections.ts`, `data/page-heroes.ts` | Headings and the banner of each page                                                         |
| `data/navigation.ts`                      | The menu and the footer links                                                                |
| `data/announcements.ts`                   | The first set of notices (the live ones are in News and events)                              |
| `lib/constants.ts`                        | The University's name, e-mail, phone, address, bank, social links, site address, file limits |

Placeholders still to be replaced are in [GO-LIVE-CHECKLIST.md](GO-LIVE-CHECKLIST.md), section C.

## The application

- A candidate chooses the **school**, then the **department**. If the department has no vacancy this session the candidate is told so and cannot go further; with a vacancy the next questions appear.
- A draft is kept in the candidate's browser; documents are uploaded when the form is submitted.
- When the window is closed the page says that the application portal will open soon.

## Search engines (SEO)

- Each page has a title, description and a canonical address; the home and Supervisors pages carry structured data (the University, the website, the supervisors).
- `/sitemap.xml` lists the public pages; `/robots.txt` keeps the portals, sign-in pages and the programming interface out of search.
- The Supervisors page is built on the server, so search engines read every profile; a change in Supervisor profiles shows within minutes.
- After going live: add the site in **Google Search Console** and submit `/sitemap.xml`.

## Looks and accessibility

- Colours and type are set once in `styles/theme.css`; logos are in `public/assets`.
- Every page works on a phone, has a skip-to-content link, visible focus and text alternatives for images. Check new pages the same way.
- The text of a statement block on the home page is justified; add new text with the same style.

## Adding a page

Ask the programmer: a page is a folder in `app/(public)/<name>/page.tsx` plus a line in `data/navigation.ts` and in `app/sitemap.ts`. See [DEVELOPER.md](DEVELOPER.md).
