import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Enforce role-based access for Settings & user management
    // COUNSELOR & READONLY are prohibited from accessing /settings
    if (pathname === "/settings" || pathname.startsWith("/settings/")) {
      if (token?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/?access_denied=admin_required", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/leads/:path*",
    "/students/:path*",
    "/agents/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/settings",
  ],
};
