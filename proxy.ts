import { NextResponse, type NextRequest } from "next/server";
import { isStaffCookie, STAFF_SESSION_COOKIE } from "@/lib/staff-cookie";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/staff/login";
  const isLoginApi = pathname === "/api/staff/login";
  const isLogoutApi = pathname === "/api/staff/logout";
  const isStaffPage = pathname === "/staff" || pathname.startsWith("/staff/");
  const isStaffApi = pathname.startsWith("/api/staff/");

  if (isLoginApi || isLogoutApi || isLoginPage) {
    return NextResponse.next();
  }

  if (!isStaffPage && !isStaffApi) {
    return NextResponse.next();
  }

  const authed = isStaffCookie(request.cookies.get(STAFF_SESSION_COOKIE)?.value);
  if (authed) {
    return NextResponse.next();
  }

  if (isStaffApi) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const login = new URL("/staff/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/staff", "/staff/:path*", "/api/staff/:path*"],
};
