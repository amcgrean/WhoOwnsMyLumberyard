import Link from "next/link";
import { SearchBar } from "@/components/search-bar";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-accent">404</p>
      <h1 className="mt-2 font-serif text-[clamp(28px,4vw,38px)] font-semibold tracking-tight text-ink">
        Not in the database
      </h1>
      <p className="mt-3 text-[15px] leading-[1.6] text-muted">
        We don&rsquo;t have a record at this URL. The business may not be tracked yet, or its
        page may have moved. Try searching for it:
      </p>
      <div className="mx-auto mt-6 max-w-[520px] text-left">
        <SearchBar variant="hero" />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5 text-[13.5px]">
        <Link href="/" className="rounded-full border border-rule bg-paper px-4 py-1.5 font-semibold text-ink hover:border-accent hover:text-accent">
          Home
        </Link>
        <Link href="/map" className="rounded-full border border-rule bg-paper px-4 py-1.5 font-semibold text-ink hover:border-accent hover:text-accent">
          Open the map
        </Link>
        <Link href="/submit" className="rounded-full border border-rule bg-paper px-4 py-1.5 font-semibold text-ink hover:border-accent hover:text-accent">
          Suggest a business
        </Link>
      </div>
    </div>
  );
}
