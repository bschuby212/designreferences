/** Pattern tags stored without #. Cards add the prefix; filters and nav do not. */

const TYPE_TAGS = [
  "mobile",
  "product",
  "dashboard",
  "onboarding",
  "navigation",
  "motion",
  "website",
] as const;

export function parseTagInput(raw: string) {
  return raw
    .split(",")
    .map((value) => value.trim().replace(/^#/, "").trim().toLowerCase())
    .filter(Boolean);
}

export function productTagsFor(collection: string, title = "") {
  const text = `${collection} ${title}`.toLowerCase();
  if (collection === "Mobile Apps" || /\bios\b|iphone|\bmobile\b/.test(text)) {
    return ["mobile"];
  }
  if (
    collection === "Product Design" ||
    collection === "Dashboards" ||
    /dashboard/.test(text)
  ) {
    return ["product"];
  }
  if (collection === "Onboarding" || /onboarding/.test(text)) return ["onboarding"];
  if (collection === "Navigation" || /navigation|tab bar/.test(text)) {
    return ["navigation"];
  }
  if (collection === "Motion" || /motion/.test(text)) return ["motion"];
  if (
    collection === "Website" ||
    collection === "Marketing" ||
    collection === "Web" ||
    collection === "Typography" ||
    collection === "Branding"
  ) {
    return ["website"];
  }
  return ["website"];
}

export function typeTagOf(tags: string[], collection = "") {
  const found = TYPE_TAGS.find((tag) => tags.includes(tag));
  if (found) return found;
  return productTagsFor(collection)[0] ?? "website";
}

export function cardTagLabel(tag: string) {
  const clean = tag.replace(/^#/, "").trim();
  return `# ${clean}`;
}

/** Drop filler like "iOS screen" / "Web section" so the title is the product. */
export function cleanDesignTitle(title: string) {
  const cleaned = title
    .replace(/\s*\|\s*Mobbin.*$/i, "")
    .replace(/\b(iOS|Android|Web)\b/gi, " ")
    .replace(/\b(screens?|sections?|homepage|landing page|with content|onboarding flow|flow)\b/gi, " ")
    .replace(/\b(\w+)\s+\1\b/gi, "$1")
    .replace(/[\s,/|–—-]+/g, " ")
    .trim();
  return cleaned || title.trim();
}

export const PHONE_COLLECTIONS = new Set(["Mobile Apps", "Onboarding"]);
