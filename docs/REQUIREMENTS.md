You are a senior full-stack engineer and UI/UX designer. We are building the Research (PhD) ERP for St. Joseph University (A State Private University established under Tamil Nadu Private Universities Act, 2019; tagline "Fully Human & Fully Alive").

THIS TASK: build ONLY the frontend of (1) the public Home page and (2) the Scholar, Supervisor and Admin login pages. No backend yet. Use mock data. Structure the code so the remaining modules can be added later without refactoring.

Read docs/REQUIREMENTS.md first. It is the source of truth for the whole ERP. For this task, use it to decide what content belongs on the Home page.

## 1. Tech stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui + lucide-react icons
- Framer Motion for subtle animations only (fade/slide on scroll, hover states)
- react-hook-form + zod for the login forms
- next/font: "Playfair Display" or "Merriweather" for headings, "Inter" for body
- Fully responsive (mobile-first), accessible (WCAG AA, keyboard navigable, visible focus, alt text, semantic landmarks), fast (next/image, no layout shift)

## 2. Brand and assets

- Logos: /public/assets/logo-full.jpeg (wide logo, use in the header and footer) and /public/assets/logo-emblem.jpeg (round emblem, use for favicon, login pages, loading states, and as a subtle watermark in the hero).
- Extract the palette from the logo and define it as Tailwind theme tokens / CSS variables:
  - Primary: deep royal purple (about #5B2A86)
  - Accent: gold/yellow (about #F2C230)
  - Secondary accent: maroon (about #8B1E3F)
  - Neutrals: warm off-white background (#FAF8FC), slate text
- Look and feel: professional, modern, clean, academic and trustworthy. Think top-tier university research portals, with generous whitespace, soft shadows, rounded-xl cards, thin gold dividers, no clutter. No stock-photo overload. Use gradients, patterns and illustrative icons instead.
- Create a small design system in /components/ui and /styles (buttons, badges, section headings, cards, container) and reuse it everywhere.

## 3. Home page (route: /) sections, in this order

1. Top utility bar: "Admissions open for Ph.D. 2026" notice, helpdesk email/phone (placeholders), Login shortcuts.
2. Sticky navbar: full logo on the left. Links: Home, About Research, Research Areas, Programmes & Fees, Admission Process, Supervisors, Publications, Downloads, Contact. Right side: "Apply Now" (gold button) and a "Login" dropdown (Scholar / Supervisor / Admin). Mobile: slide-in drawer menu.
3. Hero: strong headline (for example "Advancing Knowledge. Shaping Scholars."), a short subtext, CTAs "Apply for Ph.D." and "Scholar Login", a secondary link "Become a Supervisor". Beside it, a visual panel (glass-style card) with quick facts. Use the emblem as a faint watermark.
4. Notifications / Announcements ticker or card list (mock: admission notification, written test date, colloquium May/November, etc.) with date badges and a "View all" link.
5. Quick access cards (icons): Apply Online, Scholar Login, Supervisor Login, Supervisor Recognition Application, Check Application Status, Download Guidelines.
6. Research Areas by School: a responsive grid or tabs of schools (mock: Engineering & Technology, Sciences, Management, Commerce, Humanities, Languages, Law, Medicine/Health Sciences). Each card shows an icon, school name, and 3-4 sample research areas, and the data is easy to edit from /data/schools.ts.
7. Programmes & Fee Structure: a clean comparison of three modes: Full Time, Part Time Internal, Part Time External.
   - Full Time: minimum 3 years, Rs. 70,000 per year
   - Part Time: minimum 4 years, Rs. 50,000 per year
   - Application fee: Rs. 500 (pay to the college account; receipt upload required)
     Use a pricing-card style layout and a footnote that fees are subject to university revision.
8. Admission Process: a horizontal stepper/timeline (vertical on mobile): Apply Online > Acknowledgement Mail > Written Test & Interview > Provisional Selection > Certificate Submission & Fee Payment > First DC Meeting & Supervisor Allocation.
9. Application checklist: "Documents you'll need": passport photo (200-600 KB), signature (20-40 KB), fee receipt, UG degree, PG consolidated marksheet/provisional/degree, SET/NET (optional), date of birth proof.
10. Scholar Journey / Milestones: a visual roadmap of First DC > Course Work (Sem 1: Research Methodology, Research Publication & Ethics; Sem 2: Elective, Major) > Colloquium (May/Nov) > Second DC (Ph.D. Confirmation) > Publications > Third DC > Synopsis > Fourth DC > Thesis. Mention that course work must be completed within 2 years (4 semesters).
11. For Supervisors: a split section explaining the recognition process (Online application, publication details, approval by admin, dashboard to track scholars' milestones), with a CTA "Apply for Supervisor Recognition".
12. Stats strip (animated counters, mock numbers): Active Scholars, Recognised Supervisors, Publications, Research Schools.
13. Featured Publications / Research Highlights: 3 mock cards.
14. FAQ accordion (6-8 items drawn from the requirements: fees, eligibility, documents, duration, course work, publications needed before synopsis).
15. Contact / Helpdesk block with an address placeholder and map placeholder.
16. Footer: full logo, university affiliation line, quick links, contact, social icons, copyright, Privacy/Terms placeholders.

## 4. Login pages

Routes: /login/scholar, /login/supervisor, /login/admin (a shared <AuthLayout/> and <LoginForm role="..."/> component).

- Split-screen layout: left is a purple gradient brand panel with the emblem, welcome text and 3 role-specific benefit bullets. Right is the form card.
- Fields: Scholar uses Application No / Registration No or Email + Password. Supervisor uses Email / Supervisor ID + Password. Admin uses Username + Password.
- Include: show/hide password, "Remember me", "Forgot password?" link, a captcha component (build a simple, swappable <Captcha/> placeholder with a refresh button, the arithmetic or text challenge being mocked client-side for now), loading and error states, and a toggle or links to switch between the three roles.
- Under the Scholar form: "New applicant? Apply now". Under the Supervisor form: "Not recognised yet? Apply for Supervisor Recognition".
- Validate with zod, show inline errors, and do NOT implement real auth. Submit calls a mock function in /lib/auth.ts that returns a fake success and redirects to a placeholder /scholar/dashboard, /supervisor/dashboard or /admin/dashboard page ("Coming soon" with the layout shell: sidebar + topbar + notification bell).

## 5. Project structure (set up now for future work)

/app
(public)/page.tsx, /about, etc. (only create the Home page now)
(auth)/login/[role]/page.tsx
(portal)/scholar/dashboard, supervisor/dashboard, admin/dashboard (placeholder shells)
/components
layout/ (Navbar, Footer, TopBar, PortalShell)
home/ (Hero, Announcements, QuickAccess, ResearchAreas, FeeCards, AdmissionStepper, Milestones, SupervisorCTA, Stats, Publications, FAQ, Contact)
auth/ (AuthLayout, LoginForm, Captcha)
ui/ (shadcn + custom primitives)
/data (schools.ts, fees.ts, announcements.ts, faqs.ts, milestones.ts, all typed mock data)
/lib (utils.ts, auth.ts mock, constants.ts for university name and contact)
/types
/docs/REQUIREMENTS.md

Also create .cursor/rules/erp.mdc with these conventions: TypeScript strict, server components by default, "use client" only where needed, no hard-coded content inside components (use /data), reuse the design tokens, roles are scholar | supervisor | admin, and every future form must validate with zod.

## 6. Quality bar

- Lighthouse targets: Performance 90+, Accessibility 95+, SEO 90+. Add proper metadata, Open Graph tags and the favicon (the emblem).
- Smooth anchor scrolling, a sticky navbar with a shadow on scroll, subtle reveal animations, and respect prefers-reduced-motion.
- No lorem ipsum. Write realistic, concise academic copy.
- No console errors or warnings, and ESLint + Prettier clean.
- Deliver working code with npm run dev, a short README (setup, structure, how to edit content in /data), and a list of the placeholders I must replace later (contact details, bank account info, real dates, real school and area names).

## 7. Process

1. First, present a short plan (the file tree and component list) and wait for no approval, then start building immediately.
2. Build in this order: design tokens, layout components, Home sections top to bottom, login pages, portal placeholder shells.
3. After finishing, summarize what was built and propose the next module to implement, which should be the Application Form with file-size validation (photo 200-600 KB, signature 20-40 KB).
