"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the tz cookie in sync with the device timezone so server components
 * render viewer-local dates. Refreshes once when the cookie was missing or stale.
 */
export default function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || document.cookie.split("; ").includes(`tz=${tz}`)) return;
    document.cookie = `tz=${tz}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
