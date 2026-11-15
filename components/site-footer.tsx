import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

const EXPLORE: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/map", label: "Interactive map" },
  { href: "/search", label: "Search the record" },
  { href: "/state/iowa", label: "Iowa overview" },
  { href: "/state/iowa/hvac", label: "Iowa HVAC" },
  { href: "/state/iowa/plumbing", label: "Iowa plumbing" },
  { href: "/state/iowa/electrical", label: "Iowa electrical" },
  { href: "/state/iowa/lumber", label: "Iowa lumberyards" },
];

const ABOUT: ReadonlyArray<{ href: string; label: string; external?: boolean }> = [
  { href: "/methodology", label: "Methodology & sources" },
  { href: "/about", label: "About this site" },
  { href: "/submit", label: "Submit a correction or tip" },
  { href: "https://github.com/amcgrean/WhoOwnsMyLumberyard", label: "Source on GitHub", external: true },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-rule bg-paper2/60">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[6px] bg-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 21h18 M5 21V8l7-4 7 4v13 M10 21v-5h4v5" />
              </svg>
            </span>
            <span className="font-serif text-[17px] font-semibold tracking-tight text-ink">{SITE_NAME}</span>
          </div>
          <p className="mt-3 max-w-[46ch] text-[13px] leading-[1.6] text-muted">
            An independent, public database of who owns the plumbers, electricians, HVAC
            companies, and lumberyards behind the name on the sign. Every ownership claim links
            to a primary source.
          </p>
          <p className="mt-3 max-w-[46ch] text-[12px] leading-[1.55] text-muted">
            &ldquo;Locally owned&rdquo; reflects the best available public record, not certainty —
            private deals often go unannounced.
          </p>
        </div>

        <nav aria-label="Explore">
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">Explore</div>
          <ul className="mt-3 flex flex-col gap-2 text-[13.5px]">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink/80 transition-colors hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="About">
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted">About</div>
          <ul className="mt-3 flex flex-col gap-2 text-[13.5px]">
            {ABOUT.map((l) => (
              <li key={l.href}>
                {l.external ? (
                  <a href={l.href} target="_blank" rel="noreferrer" className="text-ink/80 transition-colors hover:text-accent">
                    {l.label}
                  </a>
                ) : (
                  <Link href={l.href} className="text-ink/80 transition-colors hover:text-accent">
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 text-[12px] text-muted">
          <span>
            &copy; {year} {SITE_NAME}
          </span>
          <span>Code under MIT &middot; Data under CC&nbsp;BY-SA&nbsp;4.0 &middot; Map data &copy; OpenStreetMap contributors</span>
        </div>
      </div>
    </footer>
  );
}
