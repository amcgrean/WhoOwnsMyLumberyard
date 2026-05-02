import { ImageResponse } from "next/og";
import { getLocationBySlug } from "@/lib/queries/locations";
import { getCompanyBySlug } from "@/lib/queries/companies";
import {
  classifyOwnership,
  getOwnershipChain,
  ultimateOwner,
} from "@/lib/ownership-graph";
import {
  COMPANY_TYPE_LABELS,
  OWNERSHIP_BADGE_LABELS,
  STATE_NAME_BY_CODE,
} from "@/lib/constants";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

type Params = Promise<{ type: string; slug: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { type, slug } = await params;
  const data = await loadData(type, slug);
  if (!data) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fafafa",
          color: "#1a1a1a",
          padding: "60px 64px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#666",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          <span>{data.kicker}</span>
          <span>Who Owns My Lumberyard</span>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 64,
            lineHeight: 1.1,
            display: "flex",
          }}
        >
          {data.title}
        </div>
        <div style={{ marginTop: 18, fontSize: 28, color: "#444" }}>{data.subtitle}</div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            background: "#2d4a3a",
            color: "white",
            padding: "10px 18px",
            fontSize: 22,
            borderRadius: 999,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {data.badge}
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}

async function loadData(type: string, slug: string) {
  if (type === "yard") {
    const loc = await getLocationBySlug(slug);
    if (!loc) return null;
    const chain = await getOwnershipChain(loc.companyId);
    const owner = ultimateOwner(chain);
    const badgeKind = classifyOwnership(chain);
    const stateName = STATE_NAME_BY_CODE[loc.state] ?? loc.state;
    return {
      kicker: "Yard",
      title: loc.displayName,
      subtitle: `${loc.city}, ${stateName}`,
      badge:
        owner && owner.id !== loc.companyId
          ? `Owned by ${owner.name}`
          : OWNERSHIP_BADGE_LABELS[badgeKind],
    };
  }
  if (type === "company" || type === "owner") {
    const c = await getCompanyBySlug(slug);
    if (!c) return null;
    const chain = await getOwnershipChain(c.id);
    const owner = ultimateOwner(chain);
    const badgeKind = classifyOwnership(chain);
    return {
      kicker: COMPANY_TYPE_LABELS[c.type],
      title: c.name,
      subtitle: c.headquartersCity ? `${c.headquartersCity}, ${c.headquartersState}` : "",
      badge:
        owner && owner.id !== c.id
          ? `Owned by ${owner.name}`
          : OWNERSHIP_BADGE_LABELS[badgeKind],
    };
  }
  return null;
}
