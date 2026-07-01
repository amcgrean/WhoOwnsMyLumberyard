"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The boxed search field for the /search page. Restyled to the design handoff:
 * bg-paper, 1.5px rule border, 12px radius, magnifier + input, plus a "Clear"
 * button that appears once there's text. Submitting (Enter) navigates to
 * /search?q=… — same GET mechanism the rest of the app uses.
 */
export function SearchField({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  function clear() {
    setQ("");
    router.push("/search");
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex max-w-[640px] items-center gap-2.5 rounded-[12px] border-[1.5px] border-rule bg-paper pl-3.5 pr-1.5 shadow-[0_2px_10px_-8px_rgba(30,30,20,0.4)]"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
        className="shrink-0"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Business, brand, or owner…"
        // text-base (16px) keeps iOS Safari from auto-zooming on focus.
        className="min-w-0 flex-1 border-0 bg-transparent py-[13px] text-base sm:text-[15px] text-ink placeholder:text-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        aria-label="Search businesses, companies, and owners"
      />
      {q ? (
        <button
          type="button"
          onClick={clear}
          className="shrink-0 cursor-pointer border-0 bg-transparent px-2 py-1.5 text-[13px] text-muted hover:text-ink"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
