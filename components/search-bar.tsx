"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

export function SearchBar({
  compact = false,
  variant = "default",
}: {
  compact?: boolean;
  /** "hero" renders the boxed, accent-button treatment used on the home page. */
  variant?: "default" | "hero";
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  if (variant === "hero") {
    return (
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-[var(--color-rule)] bg-[var(--color-paper)] pl-3.5 pr-1.5 shadow-[0_2px_10px_-8px_rgba(30,30,20,0.4)]"
      >
        <Search
          className="pointer-events-none size-[18px] shrink-0 text-[var(--color-muted)]"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a business, brand, or owner…"
          // text-base (16px) avoids iOS Safari focus-zoom; sm:text-[15px] matches spec.
          className="min-w-0 flex-1 border-0 bg-transparent py-3.5 text-base sm:text-[15px] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none"
          aria-label="Search businesses, companies, and owners"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Search
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-muted)]"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? "Zip, business, or city" : "Enter a zip code, business name, or city"}
        // text-base (16px) on the input keeps iOS Safari from auto-zooming on
        // focus. text-sm tightens the visible typography on >=sm.
        className={
          "w-full rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] " +
          "pl-9 pr-3 py-2 text-base sm:text-sm placeholder:text-[var(--color-muted)] " +
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent " +
          (compact ? "" : "py-3 text-base")
        }
        aria-label="Search businesses, companies, and owners"
      />
    </form>
  );
}
