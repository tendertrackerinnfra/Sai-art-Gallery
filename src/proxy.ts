import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session-token";

export function proxy(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/products/:path*",
    "/raw-materials/:path*",
    "/production/:path*",
    "/sales/:path*",
    "/billing/:path*",
    "/purchases/:path*",
    "/vendors/:path*",
    "/customers/:path*",
    "/custom-orders/:path*",
    "/expenses/:path*",
    "/payments/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/backup-restore/:path*",
    "/audit-logs/:path*",
  ],
};
