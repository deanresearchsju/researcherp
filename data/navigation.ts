import type { NavLink } from "@/types";

export const portalBarLabel = "Portal access";

export const primaryNav: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Announcements", href: "/announcements" },
  { label: "Admission", href: "/admission" },
  { label: "Supervisors", href: "/supervisors" },
  { label: "Our Team", href: "/our-team" },
  { label: "Contact", href: "/contact" },
];

export const footerExplore: NavLink[] = [
  { label: "Announcements", href: "/announcements" },
  { label: "Admission", href: "/admission" },
  { label: "Scholar journey", href: "/scholar-journey" },
  { label: "Supervisors", href: "/supervisors" },
  { label: "Our team", href: "/our-team" },
  { label: "Downloads", href: "/downloads" },
];

export const footerPortals: NavLink[] = [
  { label: "Scholar login", href: "/login/scholar" },
  { label: "Supervisor login", href: "/login/supervisor" },
  { label: "Administrative login", href: "/login/admin" },
  { label: "Apply for Ph.D.", href: "/apply" },
];
