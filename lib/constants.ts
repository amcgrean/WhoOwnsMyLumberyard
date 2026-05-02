import type { CompanyType } from "@/lib/db/schema";

export const SITE_NAME = "Who Owns My Lumberyard";
export const SITE_TAGLINE = "Public ownership records for U.S. building-materials dealers.";
export const SITE_DESCRIPTION =
  "A public, sourced database that maps the ownership chain behind every consolidated lumberyard and building-materials dealer in the United States — from the brand on the sign to the ultimate owner.";

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  yard: "Yard",
  consolidator: "Consolidator",
  pe_firm: "Private Equity",
  public_company: "Public Company",
  coop: "Co-op / Buying Group",
  holding_company: "Holding Company",
  family_office: "Family Office",
};

export type OwnershipBadgeKind =
  | "independent"
  | "private_equity"
  | "public"
  | "coop"
  | "family_mega"
  | "unknown";

export const OWNERSHIP_BADGE_LABELS: Record<OwnershipBadgeKind, string> = {
  independent: "Independent",
  private_equity: "Private Equity-owned",
  public: "Public Company",
  coop: "Co-op Member",
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
];
