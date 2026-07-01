"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  links: ReadonlyArray<{ href: string; label: string }>;
  className?: string;
};

export function NavPills({ links, className = "" }: Props) {
  const pathname = usePathname();

  return (
    <nav className={`items-center gap-[2px] ${className}`}>
      {links.map((l) => {
        const active =
          pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              "rounded-[8px] px-3 py-2 text-[13.5px] transition-colors " +
              (active
                ? "bg-accent-soft font-semibold text-accent"
                : "font-medium text-muted hover:text-ink")
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
