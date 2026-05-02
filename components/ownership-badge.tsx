import { OWNERSHIP_BADGE_LABELS, type OwnershipBadgeKind } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<OwnershipBadgeKind, string> = {
  independent: "bg-[var(--color-badge-independent)]/10 text-[var(--color-badge-independent)] ring-[var(--color-badge-independent)]/30",
  private_equity: "bg-[var(--color-badge-pe)]/10 text-[var(--color-badge-pe)] ring-[var(--color-badge-pe)]/30",
  public: "bg-[var(--color-badge-public)]/10 text-[var(--color-badge-public)] ring-[var(--color-badge-public)]/30",
  coop: "bg-[var(--color-badge-coop)]/10 text-[var(--color-badge-coop)] ring-[var(--color-badge-coop)]/30",
  family_mega: "bg-[var(--color-badge-family)]/10 text-[var(--color-badge-family)] ring-[var(--color-badge-family)]/30",
  unknown: "bg-[var(--color-badge-unknown)]/10 text-[var(--color-badge-unknown)] ring-[var(--color-badge-unknown)]/30",
};

export function OwnershipBadge({
  kind,
  label,
  className,
}: {
  kind: OwnershipBadgeKind;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        STYLES[kind],
        className
      )}
    >
      <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
      {label ?? OWNERSHIP_BADGE_LABELS[kind]}
    </span>
  );
}
