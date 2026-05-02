import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Who runs Who Owns My Lumberyard, why the site exists, and how the data is gathered.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto px-4 py-12 prose-editorial">
      <h1>About this site</h1>
      <p>
        <strong>Who Owns My Lumberyard</strong> is a public, sourced reference that maps the
        ownership of consolidated lumberyards and building-materials dealers in the United
        States. For each yard listed, the site traces the chain from the brand on the sign
        up to the ultimate owner — a public company, a private-equity firm, a family office,
        a co-op, or in some cases a still-independent operator.
      </p>

      <h2>Why this exists</h2>
      <p>
        Over the last fifteen years, large public consolidators and private-equity-backed
        platforms have acquired thousands of legacy yards while keeping the original brand
        names on the buildings. A contractor or homeowner driving into the same yard their
        grandfather drove into often has no way to know who actually owns it now. This site
        publishes that information in a single, citable place.
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
        <li>Search any yard by zip code, business name, or city.</li>
        <li>Browse the national map to see where each consolidator operates.</li>
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
