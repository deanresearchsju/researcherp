import type { Announcement, NewsItem } from "@/types";

export const newsKinds = ["Announcement", "Event"] as const;

export const newsNewWindowDays = 7;

export const newsBoardCopy = {
  tabsLabel: "Announcement and events",
  announcementTab: "Announcement",
  eventsTab: "Events",
  postedDate: "Posted date",
  lastDate: "Last date",
  newBadge: "New",
  latestBadge: "Latest",
  emptyAnnouncement: "No announcements have been published from the ERP.",
  emptyEvent: "No events have been published from the ERP.",
  eventDate: "Date",
  venue: "Venue",
  invitation: "Invitation",
  photosBack: "Back to events",
  photosClose: "Close",
  emptyEventPhotos: "No photos have been added for this event.",
  tickerLabel: "Announcements",
} as const;

export const newsFormCopy = {
  title: "News and events",
  addTitle: "Add an announcement or event",
  editTitle: "Edit item",
  kind: "Kind",
  itemTitle: "Title",
  postedDate: "Posted date",
  eventDate: "Event date",
  lastDate: "Last date",
  venue: "Venue",
  invitation: "Invitation",
  link: "Link",
  linkHint: "Optional. Use an http or https URL.",
  summary: "Summary",
  poster: "Poster",
  photos: "Event photos",
};

export const announcements: Announcement[] = [
  {
    id: "admissions-2026",
    title: "Ph.D. admissions 2026 are open",
    date: "01 Sep 2026",
    isoDate: "2026-09-01",
    category: "Admissions",
    summary:
      "Online applications are invited for full-time and part-time doctoral programmes across all research schools. There are two Ph.D. admission sessions each year: January and July.",
  },
  {
    id: "written-test",
    title: "Written test and interview",
    date: "20 Oct 2026",
    isoDate: "2026-10-20",
    category: "Selection",
    summary:
      "Shortlisted applicants will be called for the written test and interview. The detailed schedule will be mailed to the registered address.",
  },
  {
    id: "colloquium-nov",
    title: "November colloquium window",
    date: "05 Nov 2026",
    isoDate: "2026-11-05",
    category: "Colloquium",
    summary:
      "Scholars due for colloquium may present in the November window. The May window remains the other sitting in the academic year.",
  },
  {
    id: "supervisor-recognition",
    title: "Supervisor recognition applications",
    date: "15 Oct 2026",
    isoDate: "2026-10-15",
    category: "Supervisors",
    summary:
      "Faculty seeking recognition may submit the online application with publication details for review by the research office.",
  },
  {
    id: "course-work",
    title: "Semester 1 course work registration",
    date: "12 Aug 2026",
    isoDate: "2026-08-12",
    category: "Course work",
    summary:
      "Newly admitted scholars register for Research Methodology and Research Publication & Ethics in the first semester.",
  },
];

export const newsSeed: NewsItem[] = [];
