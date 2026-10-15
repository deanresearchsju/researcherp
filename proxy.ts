import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canOpenMenu, isOfficeRole } from "@/lib/access";
import { decodeSessionCookie, sessionCookieName } from "@/lib/session";

function loginPath(pathname: string) {
  if (pathname.startsWith("/scholar")) return "/login/scholar";
  if (pathname.startsWith("/supervisor")) return "/login/supervisor";
  return "/login/admin";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decodeSessionCookie(
    request.cookies.get(sessionCookieName)?.value,
  );
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = loginPath(pathname);
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && !isOfficeRole(session.role)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${session.role}/dashboard`;
    return NextResponse.redirect(url);
  }
  if (
    pathname.startsWith("/scholar") &&
    session.role !== "scholar" &&
    !isOfficeRole(session.role)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${session.role}/dashboard`;
    return NextResponse.redirect(url);
  }
  if (
    pathname.startsWith("/supervisor") &&
    session.role !== "supervisor" &&
    !isOfficeRole(session.role)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${session.role}/dashboard`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/login/reset") && !session.mustReset) {
    const url = request.nextUrl.clone();
    url.pathname = `/${session.role}/dashboard`;
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/login/")) {
    return NextResponse.next();
  }
  const menuRole =
    isOfficeRole(session.role) && !pathname.startsWith("/admin") ? null : session.role;
  if (menuRole && !canOpenMenu(pathname, menuRole, session.menus)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${session.role}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/scholar/:path*", "/supervisor/:path*", "/login/reset"],
};
