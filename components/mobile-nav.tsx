"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  links: ReadonlyArray<{ href: string; label: string }>;
};

export function MobileNav({ links }: Props) {
  const [open, setOpen] = useState(false);

  // Close the sheet when the user navigates to a different route. We don't
  // have an easy hook for that without a router event subscription, so the
  // simplest reliable approach is closing on link click.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="md:hidden inline-flex items-center justify-center rounded-md border border-[var(--color-rule)] p-2 text-[var(--color-ink)]"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-sheet"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open ? (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/30"
          onClick={() => setOpen(false)}
          aria-hidden
        >
          <nav
            id="mobile-nav-sheet"
            className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-[var(--color-paper)] border-l border-[var(--color-rule)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-serif text-base">Menu</span>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md p-1.5"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ul className="space-y-1">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-md px-3 py-2 text-sm hover:bg-[var(--color-muted-bg)]"
                    onClick={() => setOpen(false)}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
}
