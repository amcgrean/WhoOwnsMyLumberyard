import Link from "next/link";
import { SearchBar } from "@/components/search-bar";
import { MobileNav } from "@/components/mobile-nav";
import { NavPills } from "@/components/nav-pills";
import { SITE_NAME } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/map", label: "Map" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
  { href: "/submit", label: "Submit a tip" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/[0.86] backdrop-blur-[10px]">
      <div className="mx-auto flex min-h-[60px] max-w-[1180px] flex-wrap items-center gap-[18px] px-5">
        <Link href="/" className="flex items-center gap-[10px] py-[10px]">
          <span className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] bg-accent">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 21h18 M5 21V8l7-4 7 4v13 M10 21v-5h4v5" />
            </svg>
          </span>
          <span className="font-serif text-[18px] font-semibold tracking-tight">
            {SITE_NAME}
          </span>
        </Link>

        {/* Desktop nav pills, pushed to the right */}
        <NavPills links={NAV_LINKS} className="ml-auto hidden md:flex" />

        {/* Desktop search */}
        <div className="hidden w-80 md:block">
          <SearchBar compact />
        </div>

        {/* Mobile menu (client island) */}
        <div className="ml-auto md:ml-0">
          <MobileNav links={NAV_LINKS} />
        </div>
      </div>

      {/* Mobile search row, always visible below the brand row */}
      <div className="mx-auto max-w-[1180px] px-5 pb-3 md:hidden">
        <SearchBar compact />
      </div>
    </header>
  );
}
