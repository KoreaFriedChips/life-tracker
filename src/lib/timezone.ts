import { cookies, headers } from "next/headers";
import { isValidTimeZone } from "./dates";

export const TIMEZONE_COOKIE = "tz";

/**
 * Viewer's IANA timezone: the tz cookie (set client-side by TimeZoneSync),
 * falling back to Vercel's geo-IP header, then the server's own timezone.
 */
export async function getViewerTimeZone(): Promise<string> {
  const cookieTz = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  if (cookieTz && isValidTimeZone(cookieTz)) return cookieTz;

  const headerTz = (await headers()).get("x-vercel-ip-timezone");
  if (headerTz && isValidTimeZone(headerTz)) return headerTz;

  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
