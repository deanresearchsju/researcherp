import type { QuickAccessItem } from "@/types";

export const quickAccess: QuickAccessItem[] = [
  {
    id: "apply",
    title: "Apply for Ph.D.",
    description: "Apply for the January or July session.",
    href: "/apply",
    icon: "file-pen",
  },
  {
    id: "scholar",
    title: "Scholar Login",
    description: "Open the scholar portal.",
    href: "/login/scholar",
    icon: "graduation-cap",
  },
  {
    id: "supervisor-login",
    title: "Supervisor Login",
    description: "Open the supervisor portal.",
    href: "/login/supervisor",
    icon: "user-round",
  },
  {
    id: "recognition",
    title: "Supervisor Recognition",
    description: "Apply for recognition.",
    href: "/supervisor-recognition/apply",
    icon: "badge-check",
  },
  {
    id: "status",
    title: "Application Status",
    description: "Look up an application number.",
    href: "/apply/status",
    icon: "search",
  },
  {
    id: "downloads",
    title: "Downloads",
    description: "Forms, guidelines, and regulations.",
    href: "/downloads",
    icon: "download",
  },
];
