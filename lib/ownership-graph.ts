import { and, eq, isNull, or, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies, ownershipEdges } from "@/lib/db/schema";
import type { Company, OwnershipEdge } from "@/lib/db/schema";
import type { OwnershipBadgeKind } from "@/lib/constants";

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
 * Rules:
 * - If any node up the chain is a public_company → "public"
 * - else if any is a pe_firm or family_office → "private_equity"
 * - else if any is a coop or relationship === "member_of" → "coop"
 * - else if root is family-controlled and large (consolidator with status active) → "family_mega"
 * - else if chain length === 1 (no parent) and yard → "independent"
 * - else "unknown"
 */
export function classifyOwnership(chain: OwnershipNode[]): OwnershipBadgeKind {
  if (chain.length === 0) return "unknown";

  // Walk from the top down — ultimate owner first
  for (let i = chain.length - 1; i >= 0; i--) {
    const t = chain[i].company.type;
    if (t === "public_company") return "public";
  }
  for (const node of chain) {
    if (node.company.type === "pe_firm") return "private_equity";
    if (node.edge?.relationship === "member_of" || node.company.type === "coop") return "coop";
  }
  for (const node of chain) {
    if (node.company.type === "family_office") return "family_mega";
  }
  // Family-owned mega: a consolidator at the top with no parent
  const top = chain[chain.length - 1].company;
  if (chain.length > 1 && top.type === "consolidator") return "family_mega";
  if (chain.length === 1) {
    return chain[0].company.type === "yard" ? "independent" : "unknown";
  }
  return "unknown";
}

/**
 * Returns the ultimate *ownership* parent — i.e. the top of the chain
 * reached only via subsidiary_of / acquired_by edges. Returns null when
 * the only parent relationship is member_of (co-op / buying-group
 * membership does not transfer ownership).
 */
export function ultimateOwner(chain: OwnershipNode[]): Company | null {
  if (chain.length === 0) return null;
  // Find the highest node reachable without crossing a member_of edge.
  let best: Company | null = null;
  for (const node of chain) {
    if (node.edge === null || node.edge.relationship !== "member_of") {
      best = node.company;
    }
  }
  // If the starting node (the yard itself) is the only non-member_of node,
  // there is no ownership parent — return null.
  if (best?.id === chain[0].company.id) return null;
  return best;
}
