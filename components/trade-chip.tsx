import type { Trade } from "@/lib/db/schema";
import { TRADE_SHORT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Trade color, shared with globals.css (--color-trade-*). Kept inline here so the
// chip can build the tinted background/border with color-mix at exactly the design
// spec (12% / 32% toward white).
const TRADE_COLOR: Record<Trade, string> = {
  lumber: "oklch(0.48 0.09 68)",
  plumbing: "oklch(0.49 0.13 252)",
  electrical: "oklch(0.53 0.13 78)",
  hvac: "oklch(0.50 0.10 205)",
};

/** Small color-coded pill labeling a business's trade. Renders nothing when trade is null. */
export function TradeChip({ trade, className }: { trade?: Trade | null; className?: string }) {
  if (!trade) return null;
  const c = TRADE_COLOR[trade];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border py-[2px] pl-2 pr-[9px] text-[11.5px] font-semibold leading-normal",
        className
      )}
      style={{
        color: c,
        background: `color-mix(in oklch, ${c} 12%, white)`,
        borderColor: `color-mix(in oklch, ${c} 32%, white)`,
      }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
      {TRADE_SHORT_LABELS[trade]}
    </span>
  );
}
