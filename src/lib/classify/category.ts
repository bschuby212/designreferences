import {
  CANONICAL_NAV_COLLECTIONS,
  type Aspect,
  type CanonicalNavCollection,
} from "@/lib/storage/types";

export type ClassifyInput = {
  title: string;
  url?: string;
  notes?: string;
  aspect?: Aspect | null;
  platform?: "ios" | "android" | "web" | string;
  screenLabels?: string[];
  originalCategory?: string;
};

const SIGNUP =
  /\b(sign[ -]?up|sign[ -]?in|log[ -]?in|log[ -]?on|register|registration|password|verification|verify|auth|account setup|create account|invitation|trial|workspace creation|email inputted|pre-filled (?:login|form)|onboarding checklist|creation options)\b/i;
const DASHBOARD =
  /\b(dashboard|analytics|reporting|admin|kpi|metrics|overview|companies list|my apps|user dashboard|data ingestion|chat start|populated video)\b/i;
const LANDING =
  /\b(landing page|homepage|home page|marketing|hero|pricing|testimonial|feature section|plan comparison)\b/i;
const ONBOARDING =
  /\b(onboarding|welcome|permission|personalization|goal selection|profile setup)\b/i;
const NAV = /\b(tab bar|bottom nav|drawer|navigation|menu)\b/i;

function uniq(names: string[]) {
  return [...new Set(names.filter(Boolean))];
}

function haystack(input: ClassifyInput) {
  return [input.title, input.notes, ...(input.screenLabels ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function platformOf(input: ClassifyInput): "ios" | "web" | "unknown" {
  if (input.platform === "ios" || input.platform === "android") return "ios";
  if (input.platform === "web") return "web";
  if (input.aspect === "portrait") return "ios";
  if (input.aspect === "landscape") return "web";
  if (/\bios\b/i.test(input.title)) return "ios";
  if (/\bweb\b/i.test(input.title)) return "web";
  return "unknown";
}

function hiddenFrom(original: string) {
  if (original === "Typography" || original === "Branding" || original === "Motion") {
    return [original];
  }
  return [];
}

/**
 * Maps a reference to canonical gallery canvases from screen purpose first,
 * then flow type, platform, and only then title keywords.
 */
export function classifyReference(input: ClassifyInput): string[] {
  const text = haystack(input);
  const platform = platformOf(input);
  const original = (input.originalCategory ?? "").trim();
  const hidden = hiddenFrom(original);

  if (original === "Motion") {
    return uniq(["Mobile Apps", "Motion"]);
  }

  if (
    original === "Navigation" ||
    original === "Mobile Navigation"
  ) {
    return uniq(["Mobile Apps", "Mobile Navigation", ...hidden]);
  }

  if (original === "Onboarding" || original === "Mobile Onboarding") {
    if (platform === "web") return uniq(["Web Sign-Up", ...hidden]);
    return uniq(["Mobile Apps", "Mobile Onboarding", ...hidden]);
  }

  if (original === "Dashboards") {
    return uniq(["Dashboards", ...hidden]);
  }

  if (
    original === "Landing Pages" ||
    original === "Typography" ||
    original === "Web & Landing Pages"
  ) {
    return uniq(["Web & Landing Pages", original === "Typography" ? "Typography" : "", ...hidden]);
  }

  if (platform === "ios") {
    if (ONBOARDING.test(text)) return uniq(["Mobile Apps", "Mobile Onboarding", ...hidden]);
    if (NAV.test(text)) return uniq(["Mobile Apps", "Mobile Navigation", ...hidden]);
    return uniq(["Mobile Apps", ...hidden]);
  }

  if (SIGNUP.test(text) || SIGNUP.test(input.title)) {
    return uniq(["Web Sign-Up", ...hidden]);
  }
  if (DASHBOARD.test(text) || DASHBOARD.test(input.title)) {
    return uniq(["Dashboards", ...hidden]);
  }
  if (LANDING.test(text) || /\b(homepage|landing)\b/i.test(input.title)) {
    if (/\baccount setup\b/i.test(text)) return uniq(["Web Sign-Up", ...hidden]);
    return uniq(["Web & Landing Pages", ...hidden]);
  }

  if (original === "Mobile Apps") {
    return uniq(["Mobile Apps", ...hidden]);
  }

  if (original === "Branding" || original === "Web" || platform === "web") {
    if (SIGNUP.test(input.title)) return uniq(["Web Sign-Up", ...hidden]);
    if (LANDING.test(input.title)) return uniq(["Web & Landing Pages", ...hidden]);
    return uniq(["Dashboards", ...hidden]);
  }

  return uniq(["Web & Landing Pages", ...hidden]);
}

export function isCanonicalNavCollection(
  name: string,
): name is CanonicalNavCollection {
  return (CANONICAL_NAV_COLLECTIONS as readonly string[]).includes(name);
}
