"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
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
        className={
          "w-full rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] " +
          "pl-9 pr-3 py-2 text-sm placeholder:text-[var(--color-muted)] " +
          "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent " +
          (compact ? "" : "py-3 text-base")
        }
        aria-label="Search yards, companies, and owners"
      />
    </form>
  );
}
