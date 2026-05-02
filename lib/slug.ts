export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function locationSlug(parts: {
  name: string;
  city: string;
  state: string;
}): string {
  return [slugify(parts.name), slugify(parts.city), parts.state.toLowerCase()]
    .filter(Boolean)
    .join("-");
}
