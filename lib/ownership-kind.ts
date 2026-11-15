import type { OwnershipBadgeKind } from "@/lib/constants";

/**
 * The single source of truth for turning an ownership chain into a badge.
 * Pure and dependency-free so it can run on the server (detail page, list
 * queries) and in the browser (map) with identical results.
 */

/** Staging bucket for bulk imports that haven't been verified/promoted yet. */
export const UNVERIFIED_COMPANY_SLUG = "unverified-independent";

export type OwnershipParts = {
  /** Slug of the operating company the location belongs to. */
  rootSlug: string;
  /** Company type of that operating company. */
  rootType: string;
  /**
   * Company types up the *ownership* chain, nearest parent first. Excludes
   * co-op membership (member_of) and franchise affiliation (franchise_of),
   * neither of which is ownership.
   */
  chainTypes: string[];
  /** Has an active co-op / buying-group membership. */
  coop: boolean;
  /** Is a franchisee of a national brand. */
  franchise: boolean;
};

export function ownershipKind(p: OwnershipParts): OwnershipBadgeKind {
  if (p.rootSlug === UNVERIFIED_COMPANY_SLUG) return "unknown";
  if (p.franchise) return "franchise";
  const all = [p.rootType, ...p.chainTypes];
  if (all.includes("public_company")) return "public";
  if (all.includes("pe_firm")) return "private_equity";
  if (all.includes("family_office")) return "family_mega";
  // Owned by a privately-held chain with no PE/public parent on record
  // (e.g. ABC Supply → Hendricks Holding). Checked before co-op membership: a
  // member yard bought by a large dealer (Munn → Mead Lumber) isn't local.
  const top = p.chainTypes[p.chainTypes.length - 1];
  if (top === "consolidator" || top === "holding_company") return "family_mega";
  if (p.coop || all.includes("coop")) return "coop";
  if (p.chainTypes.length > 0) return "unknown";
  return p.rootType === "yard" ? "independent" : "unknown";
}

/** Owned and operated locally — the businesses the site helps people find. */
export function isLocallyOwned(kind: OwnershipBadgeKind): boolean {
  return kind === "independent" || kind === "coop";
}

/** Owned up a chain by a PE firm, public company, or large private company. */
export function isChainOwned(kind: OwnershipBadgeKind): boolean {
  return kind === "private_equity" || kind === "public" || kind === "family_mega";
}

/** Parse the comma-separated chain-types string the SQL helper returns. */
export function parseChainTypes(s: string | null | undefined): string[] {
  return s ? s.split(",").filter(Boolean) : [];
}
