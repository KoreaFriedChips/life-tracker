"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/todos", label: "To-dos" },
  { href: "/calendar", label: "Calendar" },
  { href: "/people", label: "People" },
  { href: "/knowledge", label: "Knowledge" },
] as const;

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-2.5">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Life Tracker
        </Link>
        <ul className="flex gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={
                    active
                      ? "rounded-lg bg-surface-subtle px-3 py-1.5 text-sm font-medium text-foreground"
                      : "rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
                  }
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
