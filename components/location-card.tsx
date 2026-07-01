import Link from "next/link";
import type { Location } from "@/lib/db/schema";
import { STATE_NAME_BY_CODE } from "@/lib/constants";
import { TradeChip } from "@/components/trade-chip";

type Props = {
  location: Pick<
    Location,
    "slug" | "displayName" | "addressLine1" | "city" | "state" | "zip"
  > & { trade?: Location["trade"]; distanceMi?: number; companyName?: string };
};

export function LocationCard({ location }: Props) {
  return (
    <Link
      href={`/yard/${location.slug}`}
      className="block rounded-md border border-[var(--color-rule)] p-4 hover:border-[var(--color-accent)] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-serif text-base">{location.displayName}</div>
        <TradeChip trade={location.trade} className="mt-0.5 shrink-0" />
      </div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">
        {location.addressLine1}, {location.city}, {location.state} {location.zip}
      </div>
      {location.companyName ? (
        <div className="mt-1 text-xs text-[var(--color-muted)]">
          Operated as part of {location.companyName}
        </div>
      ) : null}
      {typeof location.distanceMi === "number" ? (
        <div className="mt-1 text-xs text-[var(--color-muted)]">
          {location.distanceMi.toFixed(1)} miles away · {STATE_NAME_BY_CODE[location.state] ?? location.state}
        </div>
      ) : null}
    </Link>
  );
}
