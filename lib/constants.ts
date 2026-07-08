import type { CompanyType, Trade } from "@/lib/db/schema";

export const SITE_NAME = "Who Owns My Trades";
export const SITE_TAGLINE =
  "Public ownership records for local trade & building-materials businesses.";
export const SITE_DESCRIPTION =
  "A public, sourced database that maps who owns the plumbers, electricians, HVAC companies, and lumberyards behind the brand on the sign — so you can tell a locally-owned business from one rolled up by private equity.";

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  yard: "Local Business",
  consolidator: "Consolidator",
  pe_firm: "Private Equity",
  public_company: "Public Company",
  coop: "Co-op / Buying Group",
  holding_company: "Holding Company",
  family_office: "Family Office",
};

export const TRADE_LABELS: Record<Trade, string> = {
  lumber: "Lumber & Building Materials",
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
};

// Short label for chips / badges.
export const TRADE_SHORT_LABELS: Record<Trade, string> = {
  lumber: "Lumber",
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
};

export type OwnershipBadgeKind =
  | "independent"
  | "private_equity"
  | "public"
  | "coop"
  | "franchise"
  | "family_mega"
  | "unknown";

export const OWNERSHIP_BADGE_LABELS: Record<OwnershipBadgeKind, string> = {
  independent: "Independent",
  private_equity: "Private Equity-owned",
  public: "Public Company",
  coop: "Co-op Member",
  franchise: "Franchise",
  family_mega: "Family-Owned (Large)",
  unknown: "Ownership Unknown",
};

export const US_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
];

export const STATE_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.code, s.name])
);

export const STATE_CODE_BY_SLUG: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.name.toLowerCase().replace(/\s+/g, "-"), s.code])
);

export function stateSlug(code: string): string {
  const name = STATE_NAME_BY_CODE[code.toUpperCase()];
  return name ? name.toLowerCase().replace(/\s+/g, "-") : code.toLowerCase();
}

export const SERVICE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  // Lumber & building materials
  { value: "lumber", label: "Lumber" },
  { value: "millwork", label: "Millwork" },
  { value: "truss", label: "Truss / Components" },
  { value: "install", label: "Installed Sales" },
  { value: "windows_doors", label: "Windows & Doors" },
  { value: "kitchen_bath", label: "Kitchen & Bath" },
  { value: "hardware", label: "Hardware" },
  { value: "drywall", label: "Drywall" },
  { value: "roofing", label: "Roofing" },
  { value: "siding", label: "Siding" },
  { value: "decking", label: "Decking" },
  { value: "concrete_masonry", label: "Concrete & Masonry" },
  // Plumbing
  { value: "plumbing_repair", label: "Plumbing Repair" },
  { value: "drain_sewer", label: "Drain & Sewer" },
  { value: "water_heater", label: "Water Heaters" },
  { value: "well_septic", label: "Well & Septic" },
  // Electrical
  { value: "electrical_repair", label: "Electrical Repair" },
  { value: "panel_wiring", label: "Panels & Wiring" },
  { value: "generator", label: "Generators" },
  { value: "ev_charger", label: "EV Chargers" },
  // HVAC
  { value: "hvac_install", label: "Heating & Cooling Install" },
  { value: "hvac_service", label: "HVAC Service & Repair" },
  { value: "geothermal", label: "Geothermal" },
  { value: "indoor_air", label: "Indoor Air Quality" },
];
