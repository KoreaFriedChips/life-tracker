import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** Optimistic auth check (Next 16 proxy, formerly middleware). Real enforcement lives in getDb(). */
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (pathname === "/login") {
    if (authenticated) return NextResponse.redirect(new URL("/todos", req.nextUrl));
    return NextResponse.next();
  }
  if (!authenticated) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  // Installer-fetched URLs (manifest is requested credential-less; icons back it and apple-touch-icon)
  // must never 302 to /login. `icons/` is start-anchored, exempting only /icons/*.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|icons/).*)",
  ],
};
