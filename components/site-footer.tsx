import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-[60px] border-t border-rule">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 pb-[10px] pt-6">
        <p className="max-w-[52ch] text-[12.5px] leading-[1.5] text-muted">
          Every ownership claim links to a primary source. &ldquo;Independent&rdquo;
          reflects the best available public record, not certainty &mdash; private
          deals often go unannounced.
        </p>
        <p className="text-[12.5px] text-muted">
          A journalism-grade public database &middot; Iowa
        </p>
      </div>

      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-8 text-[12.5px] text-muted">
        <Link href="/map" className="hover:text-ink">
          National map
        </Link>
        <Link href="/search" className="hover:text-ink">
          Search
        </Link>
        <Link href="/methodology" className="hover:text-ink">
          Methodology
        </Link>
        <Link href="/about" className="hover:text-ink">
          About
        </Link>
        <Link href="/submit" className="hover:text-ink">
          Submit a correction or tip
        </Link>
        <a
          href="https://github.com/amcgrean/WhoOwnsMyLumberyard"
          target="_blank"
          rel="noreferrer"
          className="hover:text-ink"
        >
          Source on GitHub
        </a>
        <span className="ml-auto">
          &copy; {year} &middot; Code under MIT &middot; Data CC&nbsp;BY-SA&nbsp;4.0
        </span>
      </div>
    </footer>
  );
}
