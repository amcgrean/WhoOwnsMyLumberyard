import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How ownership claims are sourced and verified, definitions of ownership types, and known limitations of the data.",
};

export default function MethodologyPage() {
  return (
    <article className="mx-auto px-4 py-12 prose-editorial">
      <h1>Methodology</h1>

      <h2>Sourcing standard</h2>
      <p>
        Every ownership claim on this site links to at least one public source. Acceptable
        sources, in rough order of preference: SEC filings (10-K, 8-K, S-1, proxies),
        company press releases, financial-news coverage that references one of the prior
        items, and the company's own store-locator pages or corporate website. Where a
        source is a press release republished on a third-party site, the original release
        is preferred when reachable.
      </p>
      <p>
        For each source we record the URL, the publication date, and an{" "}
        <a href="https://web.archive.org">archive.org</a> snapshot URL where available, so
        the citation survives link rot.
      </p>

      <h2>What "verified" means</h2>
      <p>
        Ownership edges in the database carry a <code>verified</code> flag. An edge is
        marked verified only after the operator has independently re-read each linked
        source and confirmed it supports the specific claim. Unverified edges are visible
        on the site but flagged as such. Most edges on a brand-new database start as
        unverified.
      </p>

      <h2>Ownership type definitions</h2>
      <ul>
        <li>
          <strong>Yard.</strong> A physical location selling lumber and / or other building
          materials to professional builders, remodelers, or homeowners.
        </li>
        <li>
          <strong>Consolidator.</strong> A multi-location operator built primarily through
          acquisition, regardless of whether it is currently independent, PE-owned, or
          public.
        </li>
        <li>
          <strong>Public company.</strong> A company whose equity trades on a U.S. exchange.
        </li>
        <li>
          <strong>Private equity firm.</strong> A fund or sponsor that holds operating
          companies in its portfolio. We use this label for the sponsor, not its individual
          funds.
        </li>
        <li>
          <strong>Co-op / buying group.</strong> A member-owned organization whose member
          yards aggregate purchasing power. Member yards remain independently owned;
          membership is recorded as <code>member_of</code>, not <code>owns</code>.
        </li>
        <li>
          <strong>Family office.</strong> A holding entity controlled by a family that owns
          one or more operating companies in the industry.
        </li>
        <li>
          <strong>Holding company.</strong> A non-operating intermediate entity in an
          ownership chain.
        </li>
      </ul>

      <h2>Known limitations</h2>
      <ul>
        <li>
          The independent-yard universe is not fully enumerated. The first pass focuses on
          consolidator-owned yards and on independents already in commercial business
          databases; many small independent yards are missing and will be added over time.
        </li>
        <li>
          Co-op member rosters are partial. Full member lists are typically not public; the
          site will fill these in via membership pages, dealer directories, and submitted
          tips.
        </li>
        <li>
          Historical ownership is incomplete. The site prioritizes current ownership;
          earlier owners are recorded only when needed to explain how a yard arrived at its
          present owner.
        </li>
        <li>
          The site does not cover non-LBM building-products distribution (e.g., HVAC, pure
          plumbing, electrical) except where a tracked consolidator also operates in those
          adjacent verticals.
        </li>
      </ul>

      <h2>Corrections</h2>
      <p>
        Corrections are accepted via the <a href="/submit">submission form</a>. A
        source-backed correction is reviewed promptly. Corrections without a source are not
        rejected outright — they are queued and used as leads.
      </p>
    </article>
  );
}
