import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isAdminOnlyPath, moduleForPath, canAccessModule, parseModuleAccess } from "@/lib/rbac";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Enforce role-based access for Settings & user management
    // COUNSELOR & READONLY are prohibited from accessing /settings
    if (isAdminOnlyPath(pathname) && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/?access_denied=admin_required", req.url));
    }

    // Per-user module restriction (Settings -> Users -> Permissions).
    const mod = moduleForPath(pathname);
    if (mod && !canAccessModule(token?.role as any, mod, parseModuleAccess(token?.moduleAccess as any))) {
      return NextResponse.redirect(new URL("/?access_denied=module_restricted", req.url));
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
    "/knowledge-base/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/settings",
    "/vendor/:path*",
  ],
};
