"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";
import CommandPalette from "@/components/CommandPalette";

const NAV_LINKS = [
  { href: "/", label: "Today" },
  { href: "/todos", label: "To-dos" },
  { href: "/calendar", label: "Calendar" },
  { href: "/people", label: "People" },
  { href: "/knowledge", label: "Knowledge" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <nav aria-label="Primary" className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-2.5">
          <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">
            Life Tracker
          </Link>
          {/* Below sm the tab bar handles section links. From sm up, min-w-0 +
              overflow lets the list shrink and scroll on narrow viewports so
              the Search trigger and Log out stay on-screen. */}
          <ul className="hidden min-w-0 gap-1 overflow-x-auto sm:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={
                    isActive(pathname, href)
                      ? "rounded-lg bg-surface-subtle px-3 py-1.5 text-sm font-medium text-foreground"
                      : "rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
                  }
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <CommandPalette />
            <form action={logout}>
              <button
                type="submit"
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
              >
                Log out
              </button>
            </form>
          </div>
        </nav>
      </header>
      {/* Phone tab bar. Sibling of the header, not a child: the header's
          backdrop-blur makes it a containing block that would trap this
          position:fixed bar inside the header strip (same reason the command
          palette portals to document.body). Bottom safe-area padding keeps the
          tabs above the iOS home indicator (viewport-fit=cover). */}
      <nav
        aria-label="Primary sections"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="flex">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={`flex h-12 items-center justify-center truncate px-1 text-xs ${
                  isActive(pathname, href) ? "font-medium text-accent" : "text-muted"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
