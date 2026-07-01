import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who runs Who Owns My Trades, why the site exists, and how the data is gathered.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto px-4 py-12 prose-editorial">
      <h1>About this site</h1>
      <p>
        <strong>Who Owns My Trades</strong> is a public, sourced reference that maps who owns
        the local trade and building-materials businesses people rely on — plumbers,
        electricians, HVAC companies, and lumberyards. For each business listed, the site
        traces the chain from the brand on the sign up to the ultimate owner — a public
        company, a private-equity firm, a family office, a co-op, or in many cases a
        still-independent, locally-owned operator.
      </p>
      <p>
        The site began by mapping lumberyards and building-materials dealers nationwide.
        It is now expanding into the residential trades — plumbing, electrical, and HVAC —
        starting with the state of <strong>Iowa</strong>, where a wave of private-equity
        acquisitions has been quietly consolidating locally-owned home-services companies.
      </p>

      <h2>Why this exists</h2>
      <p>
        Over the last fifteen years, large public consolidators and private-equity-backed
        platforms have acquired thousands of legacy yards and home-services companies while
        keeping the original brand names on the trucks and buildings. A homeowner calling
        the same plumber or heating company their family always used often has no way to know
        who actually owns it now. This site publishes that information in a single, citable
        place — so you can choose a locally-owned business on purpose.
      </p>

      <h2>Who runs it</h2>
      <p>
        The site is operated by a person who works in the LBM industry at an independent
        yard. That is a relevant disclosure: the operator has a professional interest in the
        independent side of the industry. The site addresses this by sourcing every claim to
        public documents (SEC filings, press releases, deal announcements, store-locator
        pages) and by publishing the underlying data and code openly so any reader can
        verify and contest the entries.
      </p>

      <h2>What you can do here</h2>
      <ul>
        <li>Search any business by zip code, name, or city.</li>
        <li>Browse the map to see where each consolidator operates.</li>
        <li>Read the methodology to understand how each ownership claim is verified.</li>
        <li>
          <a href="/submit">Submit a correction or a tip</a> if you have a source-backed
          update.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        Send corrections through the submission form. For other questions, the same form
        works — include a note in the message field.
      </p>
    </article>
  );
}
