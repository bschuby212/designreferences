export const SOURCE_TYPES = [
  "X",
  "Dribbble",
  "Behance",
  "Figma",
  "Mobbin",
  "Awwwards",
  "Pinterest",
  "Website",
  "Upload",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export type ThumbnailType =
  | "og"
  | "twitter"
  | "meta"
  | "screenshot"
  | "upload"
  | "placeholder";

export type Density = "compact" | "medium" | "large";

/** Portrait for phone screens, landscape for desktop captures. */
export type Aspect = "portrait" | "landscape";

export type NavView =
  | { type: "all" }
  | { type: "collection"; id: string }
  | { type: "favorites" }
  | { type: "source"; source: SourceType };

/**
 * One frame of a reference. A reference is a set of screens rather than a
 * single image so cards and the detail view can page through the real UI.
 */
export interface ReferenceScreen {
  src: string;
  label: string;
}

export interface Reference {
  id: string;
  title: string;
  url: string;
  thumbnail: Blob | null;
  thumbnailUrl: string | null;
  thumbnailType: ThumbnailType;
  source: SourceType;
  collectionIds: string[];
  screens: ReferenceScreen[];
  aspect: Aspect | null;
  /** Set on seeded examples so they can be replaced without touching user data. */
  seedKey: string | null;
  tags: string[];
  notes: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ReferenceRecord {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  thumbnailType: ThumbnailType;
  source: SourceType;
  collectionIds: string[];
  screens: ReferenceScreen[];
  aspect: Aspect | null;
  seedKey: string | null;
  tags: string[];
  notes: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MetaRecord {
  key: string;
  value: string;
}

export interface ThumbnailRecord {
  id: string;
  blob: Blob;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  sortOrder: number;
}

export interface CreateReferenceInput {
  title: string;
  url: string;
  thumbnail: Blob | null;
  thumbnailUrl?: string | null;
  thumbnailType: ThumbnailType;
  source: SourceType;
  collectionIds: string[];
  screens?: ReferenceScreen[];
  aspect?: Aspect | null;
  seedKey?: string | null;
  tags: string[];
  notes: string;
  favorite?: boolean;
}

export interface ActiveFilters {
  sources: SourceType[];
  collectionIds: string[];
  tags: string[];
}

export const EMPTY_FILTERS: ActiveFilters = {
  sources: [],
  collectionIds: [],
  tags: [],
};

export const CANONICAL_NAV_COLLECTIONS = [
  "Mobile Apps",
  "Web & Landing Pages",
  "Dashboards",
  "Mobile Onboarding",
  "Web Sign-Up",
  "Mobile Navigation",
  "Portfolios",
  "Cool stuff",
] as const;

export type CanonicalNavCollection = (typeof CANONICAL_NAV_COLLECTIONS)[number];

export const DEFAULT_COLLECTIONS = [
  ...CANONICAL_NAV_COLLECTIONS,
  "Typography",
  "Motion",
  "Branding",
];

/** Kept in IndexedDB, but not shown as gallery canvases. */
export const HIDDEN_NAV_COLLECTIONS = [
  "Typography",
  "Branding",
  "Motion",
] as const;

/** Landscape 2-up gallery canvases. */
export const LAPTOP_NAV_COLLECTIONS = [
  "Web & Landing Pages",
  "Dashboards",
  "Web Sign-Up",
  "Portfolios",
] as const;

/** Old chip names that must not be recreated after migration. */
export const OBSOLETE_NAV_COLLECTIONS = [
  "Web",
  "Website",
  "Websites",
  "Landing Page",
  "Landing Pages",
  "Onboarding",
  "Navigation",
  "Mobile",
  "Mobile App",
  "Components",
  "Product Design",
  "Marketing",
] as const;
