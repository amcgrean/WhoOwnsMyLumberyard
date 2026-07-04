import Link from "next/link";
import type { Trade } from "@/lib/db/schema";
import type { OwnershipBadgeKind } from "@/lib/constants";
import { OwnershipBadge } from "@/components/ownership-badge";
import { TradeChip } from "@/components/trade-chip";
import { cn } from "@/lib/utils";

/**
 * Clickable business row — the workhorse list item across search, trade, and
 * state pages. Serif name over a muted "City, ST · owner line", with the trade
 * chip and ownership badge right-aligned. Hovers lift slightly (see globals).
 */
export function BizRow({
  href,
  name,
  city,
  state = "IA",
  ownerLine,
  trade,
  badge,
  className,
}: {
  href: string;
  name: string;
  city: string;
  state?: string;
  ownerLine: string;
  trade?: Trade | null;
  badge: OwnershipBadgeKind;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3.5 rounded-xl border border-rule bg-paper px-[15px] py-[13px] transition-[border-color,box-shadow,transform] duration-150",
        "hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--color-accent)_50%,var(--color-rule))] hover:shadow-[0_6px_18px_-12px_rgba(30,30,20,0.5)]",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="font-serif text-[16px] font-semibold leading-[1.25] text-ink">
          {name}
        </div>
        <div className="mt-[3px] truncate text-[12.5px] text-muted">
          {city}, {state} &middot; {ownerLine}
        </div>
      </div>
      <div className="flex max-w-[52%] shrink-0 flex-wrap items-center justify-end gap-[7px]">
        <TradeChip trade={trade} />
        <OwnershipBadge kind={badge} size="sm" />
      </div>
    </Link>
  );
}
