import type { Trade } from "@/lib/db/schema";
import { TRADE_SHORT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<Trade, string> = {
  lumber: "bg-[var(--color-trade-lumber)]/10 text-[var(--color-trade-lumber)] ring-[var(--color-trade-lumber)]/30",
  plumbing: "bg-[var(--color-trade-plumbing)]/10 text-[var(--color-trade-plumbing)] ring-[var(--color-trade-plumbing)]/30",
  electrical: "bg-[var(--color-trade-electrical)]/10 text-[var(--color-trade-electrical)] ring-[var(--color-trade-electrical)]/30",
  hvac: "bg-[var(--color-trade-hvac)]/10 text-[var(--color-trade-hvac)] ring-[var(--color-trade-hvac)]/30",
};

/** Small color-coded pill labeling a business's trade. Renders nothing when trade is null. */
export function TradeChip({ trade, className }: { trade?: Trade | null; className?: string }) {
  if (!trade) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        STYLES[trade],
        className
      )}
    >
      {TRADE_SHORT_LABELS[trade]}
    </span>
  );
}
