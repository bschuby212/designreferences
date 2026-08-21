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
  tags?: string[];
  originalCategory?: string;
};

const SIGNUP =
  /\b(sign[ -]?up|sign[ -]?in|log[ -]?in|log[ -]?on|register|registration|password|verification|verify|auth|account setup|create account|invitation|trial|workspace creation|email inputted|pre-filled (?:login|form)|onboarding checklist|creation options)\b/i;
const DASHBOARD =
  /\b(dashboard|analytics|reporting|admin|kpi|metrics|overview|companies list|my apps|user dashboard|data ingestion|chat start|populated video)\b/i;
const LANDING =
  /\b(landing page|homepage|home page|marketing|hero|pricing|testimonial|feature section|plan comparison)\b/i;
const ONBOARDING =
  /\b(onboarding|welcome|permission|personalization|goal selection|profile setup|first[ -]?use|get started|set up|setup)\b/i;
const NAV = /\b(tab bar|bottom nav|drawer|navigation|menu)\b/i;

function uniq(names: string[]) {
  return [...new Set(names.filter(Boolean))];
}

/**
 * Mobile Onboarding and Mobile Apps are mutually exclusive. Onboarding,
 * welcome, setup, permission, personalization, and first-use flows stay on
 * Mobile Onboarding and must not also appear in Mobile Apps.
 */
export function exclusiveCollectionNames(names: string[]): string[] {
  const unique = uniq(names);
  if (unique.includes("Mobile Onboarding")) {
    return unique.filter((name) => name !== "Mobile Apps");
  }
  return unique;
}

function haystack(input: ClassifyInput) {
  return [input.title, input.notes, ...(input.screenLabels ?? []), ...(input.tags ?? [])]
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

function nativeOnboarding(input: ClassifyInput, text: string, original: string) {
  if (original === "Mobile Onboarding") return true;
  if (original === "Onboarding" && platformOf(input) !== "web") return true;
  if (platformOf(input) === "web") return false;
  return ONBOARDING.test(text);
}

/**
 * Maps a reference to canonical gallery canvases from screen purpose first,
 * then flow type, platform, and only then title keywords.
 *
 * "mobile" or "iOS" alone never places a flow in Mobile Apps when the purpose
 * is onboarding.
 */
export function classifyReference(input: ClassifyInput): string[] {
  const text = haystack(input);
  const platform = platformOf(input);
  const original = (input.originalCategory ?? "").trim();
  const hidden = hiddenFrom(original);

  if (original === "Motion") {
    return exclusiveCollectionNames(["Mobile Apps", "Motion"]);
  }

  if (original === "Navigation" || original === "Mobile Navigation") {
    return exclusiveCollectionNames(["Mobile Apps", "Mobile Navigation", ...hidden]);
  }

  if (nativeOnboarding(input, text, original)) {
    return exclusiveCollectionNames(["Mobile Onboarding", ...hidden]);
  }

  if (original === "Onboarding" && platform === "web") {
    return exclusiveCollectionNames(["Web Sign-Up", ...hidden]);
  }

  if (original === "Dashboards") {
    return exclusiveCollectionNames(["Dashboards", ...hidden]);
  }

  if (
    original === "Landing Pages" ||
    original === "Typography" ||
    original === "Web & Landing Pages"
  ) {
    return exclusiveCollectionNames([
      "Web & Landing Pages",
      original === "Typography" ? "Typography" : "",
      ...hidden,
    ]);
  }

  if (platform === "ios") {
    if (NAV.test(text)) {
      return exclusiveCollectionNames(["Mobile Apps", "Mobile Navigation", ...hidden]);
    }
    return exclusiveCollectionNames(["Mobile Apps", ...hidden]);
  }

  if (SIGNUP.test(text) || SIGNUP.test(input.title)) {
    return exclusiveCollectionNames(["Web Sign-Up", ...hidden]);
  }
  if (DASHBOARD.test(text) || DASHBOARD.test(input.title)) {
    return exclusiveCollectionNames(["Dashboards", ...hidden]);
  }
  if (LANDING.test(text) || /\b(homepage|landing)\b/i.test(input.title)) {
    if (/\baccount setup\b/i.test(text)) {
      return exclusiveCollectionNames(["Web Sign-Up", ...hidden]);
    }
    return exclusiveCollectionNames(["Web & Landing Pages", ...hidden]);
  }

  if (original === "Mobile Apps") {
    return exclusiveCollectionNames(["Mobile Apps", ...hidden]);
  }

  if (original === "Branding" || original === "Web" || platform === "web") {
    if (SIGNUP.test(input.title)) {
      return exclusiveCollectionNames(["Web Sign-Up", ...hidden]);
    }
    if (LANDING.test(input.title)) {
      return exclusiveCollectionNames(["Web & Landing Pages", ...hidden]);
    }
    return exclusiveCollectionNames(["Dashboards", ...hidden]);
  }

  return exclusiveCollectionNames(["Web & Landing Pages", ...hidden]);
}

export function isCanonicalNavCollection(
  name: string,
): name is CanonicalNavCollection {
  return (CANONICAL_NAV_COLLECTIONS as readonly string[]).includes(name);
}
