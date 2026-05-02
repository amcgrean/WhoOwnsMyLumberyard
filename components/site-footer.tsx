import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--color-rule)] mt-16">
      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 sm:grid-cols-3 text-sm text-[var(--color-muted)]">
        <div>
          <p className="font-serif text-[var(--color-ink)]">{SITE_NAME}</p>
          <p className="mt-2">
            A public, sourced reference on the ownership of U.S. building-materials dealers.
          </p>
        </div>
        <div>
          <p className="text-[var(--color-ink)] mb-2">Browse</p>
          <ul className="space-y-1">
            <li><Link href="/map">National map</Link></li>
            <li><Link href="/search">Search</Link></li>
            <li><Link href="/methodology">Methodology</Link></li>
            <li><Link href="/about">About</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-[var(--color-ink)] mb-2">Contribute</p>
          <ul className="space-y-1">
            <li><Link href="/submit">Submit a correction or tip</Link></li>
            <li>
              <a href="https://github.com/amcgrean/WhoOwnsMyLumberyard" target="_blank" rel="noreferrer">
                Source on GitHub
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-[var(--color-muted)]">
        © {year}. Code under MIT. Compiled ownership data published under CC&nbsp;BY-SA&nbsp;4.0.
      </div>
    </footer>
  );
}
