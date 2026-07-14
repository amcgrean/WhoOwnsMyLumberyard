import { OWNERSHIP_BADGE_LABELS, type OwnershipBadgeKind } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Solid, color-coded ownership pill with an icon — the single most important
// signal on the site. Design tokens live in globals.css (--color-badge-*).
const CFG: Record<OwnershipBadgeKind, { varName: string; icon: string }> = {
  independent: { varName: "--color-badge-independent", icon: "M20 6 9 17l-5-5" },
  private_equity: { varName: "--color-badge-pe", icon: "M12 3 2 20h20L12 3Z M12 10v4 M12 16.5h.01" },
  public: { varName: "--color-badge-public", icon: "M4 21h16 M5 21V10l7-4 7 4v11 M10 21v-6h4v6" },
  coop: { varName: "--color-badge-coop", icon: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3 20a6 6 0 0 1 12 0 M16.5 11a3 3 0 0 0 0-6 M17 20a6 6 0 0 0-3-5.2" },
  franchise: { varName: "--color-badge-franchise", icon: "M9 12a4 4 0 0 0 6 .5l2.5-2.5a4 4 0 0 0-5.7-5.7l-1 1 M15 12a4 4 0 0 0-6-.5L6.5 14a4 4 0 0 0 5.7 5.7l1-1" },
  family_mega: { varName: "--color-badge-family", icon: "M3 11 12 4l9 7 M5 9.5V20h14V9.5 M10 20v-5h4v5" },
  unknown: { varName: "--color-badge-unknown", icon: "M9.4 9a2.6 2.6 0 1 1 3.6 2.4c-1 .5-1.2 1.1-1.2 2.1 M12 17h.01" },
};

export function OwnershipBadge({
  kind,
  label,
  size = "md",
  className,
}: {
  kind: OwnershipBadgeKind;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const cfg = CFG[kind] ?? CFG.unknown;
  const sm = size === "sm";
  const iconSize = sm ? 12 : 14;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-[5px] font-semibold leading-none text-white",
        sm ? "gap-1 py-[3px] pl-1.5 pr-2 text-[11.5px]" : "gap-1.5 py-[5px] pl-2 pr-[11px] text-[12.5px]",
        className
      )}
      style={{
        background: `var(${cfg.varName})`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 1.5px rgba(0,0,0,0.10)",
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0"
      >
        <path d={cfg.icon} />
      </svg>
      <span>{label ?? OWNERSHIP_BADGE_LABELS[kind]}</span>
    </span>
  );
}
