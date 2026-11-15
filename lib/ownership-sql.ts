import { sql, getTableName, is, Column, type SQL, type AnyColumn } from "drizzle-orm";
import { ownershipKind, parseChainTypes, type OwnershipParts } from "@/lib/ownership-kind";
import type { OwnershipBadgeKind } from "@/lib/constants";

/**
 * SQL fragments that classify ownership for a set of rows in ONE query, so
 * list views (map, search, state + trade pages) don't walk the chain per
 * company. Each takes the operating company's id column. Ownership hops
 * exclude co-op membership and franchise affiliation (neither is ownership).
 */

const NOT_OWNERSHIP = sql.raw(`('member_of', 'franchise_of')`);

/**
 * Always render a column table-qualified. Drizzle omits the table name in
 * single-table queries, which makes a bare "id" ambiguous inside these
 * subqueries (ownership_edges / companies / the CTE all have an id).
 */
export function q(col: AnyColumn | SQL): SQL {
  return is(col, Column)
    ? sql`${sql.identifier(getTableName(col.table))}.${sql.identifier(col.name)}`
    : (col as SQL);
}

/** Immediate ownership parent's name (null ⇒ not owned). */
export function ownerNameSql(companyId: AnyColumn | SQL): SQL<string | null> {
  return sql<string | null>`(
    select p.name from ownership_edges e
    join companies p on p.id = e.parent_id
    where e.child_id = ${q(companyId)} and e.end_date is null
      and e.relationship not in ${NOT_OWNERSHIP}
    order by e.start_date desc nulls last
    limit 1
  )`;
}

/** The national brand this company is a franchisee of, if any. */
export function franchiseOfSql(companyId: AnyColumn | SQL): SQL<string | null> {
  return sql<string | null>`(
    select p.name from ownership_edges e
    join companies p on p.id = e.parent_id
    where e.child_id = ${q(companyId)} and e.end_date is null
      and e.relationship = 'franchise_of'
    order by e.start_date desc nulls last
    limit 1
  )`;
}

/** Whether the company has an active co-op / buying-group membership. */
export function coopSql(companyId: AnyColumn | SQL): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ownership_edges e
    where e.child_id = ${q(companyId)} and e.end_date is null
      and e.relationship = 'member_of'
  )`;
}

/**
 * Comma-separated company types up the ownership chain, nearest parent first
 * (e.g. "consolidator,pe_firm"). Depth-capped to guard against cycles.
 */
export function chainTypesSql(companyId: AnyColumn | SQL): SQL<string | null> {
  return sql<string | null>`(
    with recursive up(id, depth) as (
      select e.parent_id, 1 from ownership_edges e
      where e.child_id = ${q(companyId)} and e.end_date is null
        and e.relationship not in ${NOT_OWNERSHIP}
      union all
      select e.parent_id, up.depth + 1 from ownership_edges e
      join up on e.child_id = up.id
      where e.end_date is null
        and e.relationship not in ${NOT_OWNERSHIP}
        and up.depth < 10
    )
    select string_agg(p.type::text, ',' order by up.depth)
    from up join companies p on p.id = up.id
  )`;
}

/** Select-map entries for all ownership facts about a company. */
export function ownershipSelect(companyId: AnyColumn | SQL) {
  return {
    ownerName: ownerNameSql(companyId),
    franchiseOf: franchiseOfSql(companyId),
    isCoop: coopSql(companyId),
    chainTypes: chainTypesSql(companyId),
  };
}

/** Classify a row selected with `ownershipSelect` plus the company slug/type. */
export function kindFromRow(row: {
  companySlug: string;
  companyType: string;
  franchiseOf: string | null;
  isCoop: boolean | null;
  chainTypes: string | null;
}): OwnershipBadgeKind {
  const parts: OwnershipParts = {
    rootSlug: row.companySlug,
    rootType: row.companyType,
    chainTypes: parseChainTypes(row.chainTypes),
    coop: Boolean(row.isCoop),
    franchise: row.franchiseOf != null,
  };
  return ownershipKind(parts);
}
