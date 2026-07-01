import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">404</p>
      <h1 className="font-serif text-3xl mt-2">Not in the database</h1>
      <p className="mt-3 text-[var(--color-muted)]">
        We don&rsquo;t have a record at this URL. The business or company may not be tracked yet, or
        the slug may have changed.
      </p>
      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href="/" className="underline">
          Home
        </Link>
        <Link href="/search" className="underline">
          Search
        </Link>
        <Link href="/submit" className="underline">
          Submit a tip
        </Link>
      </div>
    </div>
  );
}
