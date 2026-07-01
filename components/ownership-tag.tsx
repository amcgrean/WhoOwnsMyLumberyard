import { cn } from "@/lib/utils";

/**
 * Compact ownership indicator for dense contexts (table rows, cards).
 * Green "Independent" when there's no owner up the chain; red "Owned by …"
 * when a parent company controls it. For the full editorial badge use
 * <OwnershipBadge/> instead.
 */
export function OwnershipTag({
  ownerName,
  className,
}: {
  ownerName?: string | null;
  className?: string;
}) {
  const owned = Boolean(ownerName);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        owned
          ? "bg-[var(--color-badge-pe)]/10 text-[var(--color-badge-pe)] ring-[var(--color-badge-pe)]/30"
          : "bg-[var(--color-badge-independent)]/10 text-[var(--color-badge-independent)] ring-[var(--color-badge-independent)]/30",
        className
      )}
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
      {owned ? `Owned by ${ownerName}` : "Independent"}
    </span>
  );
}
