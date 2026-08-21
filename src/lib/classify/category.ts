import {
  CANONICAL_NAV_COLLECTIONS,
  DEFAULT_COLLECTIONS,
  HIDDEN_NAV_COLLECTIONS,
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

const DESIGN_SYSTEM_HOSTS = [
  "nngroup.com",
  "inclusive-components.design",
  "lightningdesignsystem.com",
  "primer.style",
  "patternfly.org",
  "designsystems.com",
  "m3.material.io",
  "material.io",
  "carbondesignsystem.com",
  "polaris.shopify.com",
  "atlassian.design",
  "ant.design",
  "mui.com",
  "chakra-ui.com",
  "ui.shadcn.com",
  "radix-ui.com",
  "component.gallery",
  "ui-patterns.com",
  "uxpatterns.dev",
];

const CATEGORY_ALIASES: Record<string, string> = {
  mobile: "Mobile Apps",
  "mobile app": "Mobile Apps",
  "mobile apps": "Mobile Apps",
  ios: "Mobile Apps",
  android: "Mobile Apps",
  website: "Web & Landing Pages",
  websites: "Web & Landing Pages",
  web: "Web & Landing Pages",
  "landing page": "Web & Landing Pages",
  "landing pages": "Web & Landing Pages",
  marketing: "Web & Landing Pages",
  "web & landing pages": "Web & Landing Pages",
  dashboards: "Dashboards",
  dashboard: "Dashboards",
  onboarding: "Mobile Onboarding",
  "mobile onboarding": "Mobile Onboarding",
  navigation: "Mobile Navigation",
  "mobile navigation": "Mobile Navigation",
  "web sign-up": "Web Sign-Up",
  "web signup": "Web Sign-Up",
  "sign-up": "Web Sign-Up",
  portfolios: "Portfolios",
  portfolio: "Portfolios",
  "product design": "Dashboards",
  typography: "Typography",
  branding: "Branding",
  motion: "Motion",
};

function uniq(names: string[]) {
  return [...new Set(names.filter(Boolean))];
}

function haystack(input: ClassifyInput) {
  return [input.title, input.notes, ...(input.screenLabels ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hostOf(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isDesignSystemReference(url?: string, title = "") {
  const host = hostOf(url);
  if (DESIGN_SYSTEM_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))) {
    return true;
  }
  return /\b(design system|component library|components)\b/i.test(title);
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
  if ((HIDDEN_NAV_COLLECTIONS as readonly string[]).includes(original)) {
    return [original];
  }
  return [];
}

function allowed(names: string[]) {
  const allow = new Set<string>(DEFAULT_COLLECTIONS);
  return uniq(names.filter((name) => allow.has(name)));
}

/** Map a raw API/folder label onto an allowed collection, or null if unknown. */
export function resolveAllowedCollectionName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if ((DEFAULT_COLLECTIONS as readonly string[]).includes(trimmed)) return trimmed;
  const aliased = CATEGORY_ALIASES[trimmed.toLowerCase()];
  if (aliased) return aliased;
  return null;
}

/**
 * Maps a reference to canonical gallery canvases from screen purpose first,
 * then flow type, platform, and only then title keywords.
 */
export function classifyReference(input: ClassifyInput): string[] {
  const text = haystack(input);
  const platform = platformOf(input);
  const originalRaw = (input.originalCategory ?? "").trim();
  const original = resolveAllowedCollectionName(originalRaw) ?? originalRaw;
  const hidden = hiddenFrom(original);

  if (isDesignSystemReference(input.url, input.title) && original === "Components") {
    return [];
  }
  if (originalRaw.toLowerCase() === "components" || original === "Components") {
    if (isDesignSystemReference(input.url, input.title)) return [];
    if (SIGNUP.test(text)) return allowed(["Web Sign-Up", ...hidden]);
    if (DASHBOARD.test(text)) return allowed(["Dashboards", ...hidden]);
    if (LANDING.test(text) || platform === "web") {
      return allowed(["Web & Landing Pages", ...hidden]);
    }
    return [];
  }

  if (original === "Motion") {
    return allowed(["Mobile Apps", "Motion"]);
  }

  if (original === "Mobile Navigation" || originalRaw === "Navigation") {
    return allowed(["Mobile Navigation", ...hidden]);
  }

  if (original === "Mobile Onboarding" || originalRaw === "Onboarding") {
    if (platform === "web") return allowed(["Web Sign-Up", ...hidden]);
    return allowed(["Mobile Onboarding", ...hidden]);
  }

  if (original === "Dashboards") {
    return allowed(["Dashboards", ...hidden]);
  }

  if (original === "Web Sign-Up") {
    return allowed(["Web Sign-Up", ...hidden]);
  }

  if (original === "Typography") {
    return allowed(["Web & Landing Pages", "Typography"]);
  }

  if (original === "Web & Landing Pages") {
    if (SIGNUP.test(text)) return allowed(["Web Sign-Up", ...hidden]);
    return allowed(["Web & Landing Pages", ...hidden]);
  }

  if (original === "Mobile Apps" || platform === "ios") {
    if (ONBOARDING.test(text)) return allowed(["Mobile Onboarding", ...hidden]);
    if (NAV.test(text) && !ONBOARDING.test(text)) {
      return allowed(["Mobile Navigation", ...hidden]);
    }
    return allowed(["Mobile Apps", ...hidden]);
  }

  if (SIGNUP.test(text) || SIGNUP.test(input.title)) {
    return allowed(["Web Sign-Up", ...hidden]);
  }
  if (DASHBOARD.test(text) || DASHBOARD.test(input.title)) {
    return allowed(["Dashboards", ...hidden]);
  }
  if (LANDING.test(text) || /\b(homepage|landing)\b/i.test(input.title)) {
    if (/\baccount setup\b/i.test(text)) return allowed(["Web Sign-Up", ...hidden]);
    return allowed(["Web & Landing Pages", ...hidden]);
  }

  if (original === "Branding") {
    if (SIGNUP.test(input.title)) return allowed(["Web Sign-Up", "Branding"]);
    if (LANDING.test(input.title) || platform === "web") {
      return allowed(["Web & Landing Pages", "Branding"]);
    }
    return allowed(["Branding"]);
  }

  if (platform === "web") {
    if (SIGNUP.test(input.title)) return allowed(["Web Sign-Up", ...hidden]);
    if (DASHBOARD.test(input.title)) return allowed(["Dashboards", ...hidden]);
    if (LANDING.test(input.title)) return allowed(["Web & Landing Pages", ...hidden]);
    return [];
  }

  return allowed(hidden);
}

export function isCanonicalNavCollection(
  name: string,
): name is CanonicalNavCollection {
  return (CANONICAL_NAV_COLLECTIONS as readonly string[]).includes(name);
}

export function isSignupContent(title: string, notes = "", labels: string[] = []) {
  const text = [title, notes, ...labels].join(" ");
  return SIGNUP.test(text);
}

export function isOnboardingContent(title: string, notes = "", labels: string[] = []) {
  const text = [title, notes, ...labels].join(" ");
  return ONBOARDING.test(text);
}

export function isNavigationContent(title: string, notes = "", labels: string[] = []) {
  const text = [title, notes, ...labels].join(" ");
  return NAV.test(text) && !ONBOARDING.test(text);
}
