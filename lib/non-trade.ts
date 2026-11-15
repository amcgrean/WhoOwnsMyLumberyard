/**
 * Businesses that bulk imports pick up but that aren't lumberyards or
 * plumbing / electrical / HVAC contractors: auto repair (Google returns
 * "auto AC" and "auto electric" shops for HVAC / electrical queries), auto-parts
 * stores, hog-barn equipment, post-frame and modular builders, and pure
 * handyman services. Used by the importers so a re-import can't bring back rows
 * that scripts/seed/cleanup-non-trade.ts removed.
 */
const NON_TRADE = new RegExp(
  [
    String.raw`\bauto(motive)?\b`,
    String.raw`\btires?\b`,
    String.raw`\btyre`,
    String.raw`car (wash|care)`,
    String.raw`collision`,
    String.raw`\btransmission`,
    String.raw`muffler`,
    String.raw`oil change`,
    String.raw`truck repair`,
    String.raw`body shop`,
    String.raw`hog slat`,
    String.raw`christian brothers automotive`,
    String.raw`morton buildings`,
    String.raw`amwood homes`,
  ].join("|"),
  "i",
);

/** A trade word in the name keeps a business in ("Walls Plumbing & Handyman"). */
const TRADE_WORD = /plumb|electric|heat|hvac|air cond|cooling|furnace|lumber|rooter|drain|sewer/i;

export function isNonTradeName(name: string): boolean {
  // Co-op hardware/lumber stores that also sell auto parts stay.
  if (/do it best|true value|\bace hardware/i.test(name)) return false;
  if (/\bhandyman\b/i.test(name)) return !TRADE_WORD.test(name);
  if (/\bauto electric|automotive electric|auto electrical/i.test(name)) return true;
  return NON_TRADE.test(name);
}
