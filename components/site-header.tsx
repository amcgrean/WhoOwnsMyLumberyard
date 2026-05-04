import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { MobileNav } from "@/components/mobile-nav";
import { SITE_NAME } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/map", label: "Map" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
  { href: "/submit", label: "Submit a tip" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:py-4">
        {/* Top row: brand + mobile menu button */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="font-serif text-base sm:text-lg tracking-tight">
            {SITE_NAME}
          </Link>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 text-sm text-[var(--color-muted)]">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-[var(--color-ink)]">
                {l.label}
              </Link>
            ))}
          </nav>
          {/* Desktop search */}
          <div className="hidden md:block w-80">
            <SearchBar compact />
          </div>
          {/* Mobile menu (client island) */}
          <MobileNav links={NAV_LINKS} />
        </div>

        {/* Mobile search row, always visible below the brand row */}
        <div className="md:hidden mt-3">
          <SearchBar compact />
        </div>
      </div>
    </header>
  );
}
