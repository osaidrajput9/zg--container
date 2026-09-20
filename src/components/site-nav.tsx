"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Hero" },
  { href: "/carousel", label: "Carousel" },
  { href: "/scroll", label: "Scroll story" },
  { href: "/lab", label: "Lab" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8">
        <Link href="/" className="shrink-0 font-mono text-xs uppercase tracking-[0.22em]">
          ZG<span className="text-muted">/container</span>
        </Link>
        <ul className="nav-scroll flex min-w-0 items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`block whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs transition-colors sm:px-3 ${
                    active ? "bg-foreground text-background" : "text-muted hover:text-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
