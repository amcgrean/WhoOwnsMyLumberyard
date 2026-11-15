import { and, eq, isNull, or, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, ownershipEdges } from "@/lib/db/schema";
import type { Company, OwnershipEdge } from "@/lib/db/schema";
import type { OwnershipBadgeKind } from "@/lib/constants";
import { ownershipKind } from "@/lib/ownership-kind";

const MAX_CHAIN_DEPTH = 10;

export type OwnershipNode = {
  company: Company;
  edge: OwnershipEdge | null; // null for the root (the yard / starting node)
  depth: number;
};

/**
 * Walk ownership_edges upward from `companyId`, following currently-active
 * edges only (or edges active as of `asOf`). Returns nodes ordered from the
 * starting company up to its ultimate parent. Capped at MAX_CHAIN_DEPTH.
 */
export async function getOwnershipChain(
  companyId: string,
  asOf?: Date
): Promise<OwnershipNode[]> {
  const startDateLimit = asOf ?? new Date();
  const startIso = startDateLimit.toISOString().slice(0, 10);

  const start = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!start) return [];

  const chain: OwnershipNode[] = [{ company: start, edge: null, depth: 0 }];
  const seen = new Set<string>([start.id]);

  let cursorId: string = start.id;
  for (let depth = 1; depth <= MAX_CHAIN_DEPTH; depth++) {
    const edge = await db.query.ownershipEdges.findFirst({
      where: and(
        eq(ownershipEdges.childId, cursorId),
        or(isNull(ownershipEdges.endDate), gt(ownershipEdges.endDate, startIso))
      ),
      orderBy: (e, { desc }) => [desc(e.startDate)],
    });
    if (!edge) break;
    if (seen.has(edge.parentId)) break; // cycle guard
    const parent = await db.query.companies.findFirst({
      where: eq(companies.id, edge.parentId),
    });
    if (!parent) break;
    chain.push({ company: parent, edge, depth });
    seen.add(parent.id);
    cursorId = parent.id;
  }
  return chain;
}

/** All current children of a parent company. */
export async function getOwnedCompanies(ownerId: string): Promise<
  Array<{ company: Company; edge: OwnershipEdge }>
> {
  const edges = await db.query.ownershipEdges.findMany({
    where: and(eq(ownershipEdges.parentId, ownerId), isNull(ownershipEdges.endDate)),
  });
  if (edges.length === 0) return [];
  const childIds = edges.map((e) => e.childId);
  const childCompanies = await db.query.companies.findMany({
    where: (c, { inArray }) => inArray(c.id, childIds),
  });
  const byId = new Map(childCompanies.map((c) => [c.id, c]));
  return edges
    .map((edge) => {
      const company = byId.get(edge.childId);
      return company ? { company, edge } : null;
    })
    .filter((x): x is { company: Company; edge: OwnershipEdge } => Boolean(x));
}

/**
 * Determine the ownership badge for a company based on its chain.
 * Rules live in `ownershipKind` (lib/ownership-kind.ts): unverified bucket →
 * unknown; franchisee → franchise; public / PE / co-op / family-office anywhere
 * in the ownership chain, in that order; a private chain on top → family_mega;
 * no parent and a local business → independent.
 */
export function classifyOwnership(chain: OwnershipNode[]): OwnershipBadgeKind {
  if (chain.length === 0) return "unknown";
  // Delegate to the shared classifier so the detail page agrees exactly with
  // the list views (map, search, state + trade pages), which classify in SQL.
  // Ownership types = the chain up to the first non-ownership hop.
  const chainTypes: string[] = [];
  let coop = false;
  for (const node of chain.slice(1)) {
    const rel = node.edge?.relationship;
    if (rel === "member_of") {
      coop = true;
      break;
    }
    if (rel === "franchise_of") break;
    chainTypes.push(node.company.type);
  }
  return ownershipKind({
    rootSlug: chain[0].company.slug,
    rootType: chain[0].company.type,
    chainTypes,
    coop,
    franchise: chain[1]?.edge?.relationship === "franchise_of",
  });
}

/**
 * Returns the ultimate *ownership* parent — i.e. the top of the chain
 * reached only via ownership edges (owns / controls / subsidiary_of /
 * acquired_by). Returns null when the nearest parent link is a non-ownership
 * hop — co-op membership (member_of) or franchise affiliation (franchise_of)
 * do not transfer ownership of the business below them.
 */
export function ultimateOwner(chain: OwnershipNode[]): Company | null {
  if (chain.length === 0) return null;
  let best: Company | null = null;
  for (const node of chain) {
    // Stop at the first non-ownership hop — nodes above it own the brand, not
    // the business we started from.
    if (
      node.edge &&
      (node.edge.relationship === "member_of" || node.edge.relationship === "franchise_of")
    ) {
      break;
    }
    best = node.company;
  }
  // If the starting node (the business itself) is the only owner reached,
  // there is no ownership parent — return null.
  if (best?.id === chain[0].company.id) return null;
  return best;
}
