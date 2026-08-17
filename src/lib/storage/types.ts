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

export type NavView =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "recent" }
  | { type: "collection"; id: string }
  | { type: "source"; source: SourceType };

export interface Reference {
  id: string;
  title: string;
  url: string;
  thumbnail: Blob | null;
  thumbnailUrl: string | null;
  thumbnailType: ThumbnailType;
  imageUrls: string[];
  source: SourceType;
  collectionId: string | null;
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
  imageUrls: string[];
  source: SourceType;
  collectionId: string | null;
  tags: string[];
  notes: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
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
  imageUrls?: string[];
  source: SourceType;
  collectionId: string | null;
  tags: string[];
  notes: string;
  favorite?: boolean;
}

export interface ActiveFilters {
  sources: SourceType[];
  collectionIds: string[];
  tags: string[];
  favorites: boolean;
}

export const EMPTY_FILTERS: ActiveFilters = {
  sources: [],
  collectionIds: [],
  tags: [],
  favorites: false,
};

export const DEFAULT_COLLECTIONS = [
  "Mobile Apps",
  "Web",
  "Dashboards",
  "Onboarding",
  "Navigation",
  "Typography",
  "Motion",
  "Branding",
];
