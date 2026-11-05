/**
 * The faculty research dashboard stands on its own: no website menus, banner or footer, so the
 * figures and records fit on the screen. Its own slim top bar is drawn by the page.
 */
export default function FacultyDeskLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-muted/40">{children}</div>;
}
