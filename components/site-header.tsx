import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { SITE_NAME } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-serif text-lg tracking-tight">
            {SITE_NAME}
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
            <Link href="/map" className="hover:text-[var(--color-ink)]">Map</Link>
            <Link href="/methodology" className="hover:text-[var(--color-ink)]">Methodology</Link>
            <Link href="/about" className="hover:text-[var(--color-ink)]">About</Link>
            <Link href="/submit" className="hover:text-[var(--color-ink)]">Submit a tip</Link>
          </nav>
        </div>
        <div className="w-full sm:w-80">
          <SearchBar compact />
        </div>
      </div>
    </header>
  );
}
