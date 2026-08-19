import { isMotionSrc } from "@/lib/utils";

export const LIBRARY_COLLECTIONS = [
  "Mobile Apps",
  "Product Design",
  "Website",
  "Onboarding",
  "Navigation",
  "Motion",
] as const;

export type LibraryCollection = (typeof LIBRARY_COLLECTIONS)[number];

const DOC_NEEDLES = [
  "developer.apple.com/design",
  "developer.apple.com/sf-symbols",
  "m3.material.io",
  "material.io",
  "ionicframework.com/docs",
  "reactnative.dev/docs",
  "docs.expo.dev",
  "tokens.studio",
  "heroicons.com",
  "ionic.io/ionicons",
  "phosphoricons.com",
  "capacitorjs.com",
  "ui.shadcn.com",
  "radix-ui.com",
  "carbondesignsystem.org",
  "carbondesignsystem.com",
  "polaris.shopify.com",
  "atlassian.design",
  "fluent2.microsoft.design",
  "spectrum.adobe.com",
  "ant.design",
  "mui.com",
  "chakra-ui.com",
  "daisyui.com",
  "tailwindui.com",
  "tailwindcss.com/docs",
  "getbootstrap.com",
  "ios.design",
  "mobile-patterns.com",
  "pttrns.com",
  "screenlane.com",
  "pageflows.com",
  "refero.design",
  "uisources.com",
  "ui-patterns.com",
  "uxpatterns.dev",
  "component.gallery",
  "untitledui.com",
  "lucide.dev",
  "lawsofux.com",
  "www.w3.org/wai",
  "styled-system.com",
  "tokens.studio",
];

export interface SeedLike {
  collection: string;
  url: string;
  imageUrl: string;
  imageUrls?: string[];
  videoUrl?: string;
}

export function isPlayableMotion(seed: SeedLike) {
  const urls = [seed.videoUrl, seed.imageUrl, ...(seed.imageUrls ?? [])];
  return urls.some((url) => isMotionSrc(url));
}

export function isPhoneCapture(url: string, imageUrl?: string | null) {
  const haystack = `${url} ${imageUrl ?? ""}`;
  return (
    /\/content\/app_screens\//i.test(haystack) ||
    /mobbin\.com\/(?:explore\/)?flows\//i.test(haystack)
  );
}

export function isWebProductCapture(url: string, imageUrl?: string | null) {
  const haystack = `${url} ${imageUrl ?? ""}`;
  return /\/content\/sites\//i.test(haystack);
}

export function isMarketingCapture(url: string, imageUrl?: string | null) {
  const haystack = `${url} ${imageUrl ?? ""}`;
  return /\/(?:explore\/)?sections\//i.test(haystack);
}

export function isDocsOrCatalog(url: string) {
  const lower = url.toLowerCase();
  return DOC_NEEDLES.some((needle) => lower.includes(needle));
}

/** Exclusive home for a seed. Null means retire it. */
export function collectionForSeed(seed: SeedLike): LibraryCollection | null {
  if (isPlayableMotion(seed)) return "Motion";
  if (seed.collection === "Motion") return null;
  if (isDocsOrCatalog(seed.url)) return null;

  const phone = isPhoneCapture(seed.url, seed.imageUrl);
  const webProduct = isWebProductCapture(seed.url, seed.imageUrl);
  const marketing = isMarketingCapture(seed.url, seed.imageUrl);
  const claimed = seed.collection;

  if (claimed === "Onboarding" && (phone || /\/flows\//i.test(seed.url))) {
    return "Onboarding";
  }
  if (claimed === "Navigation" && phone) return "Navigation";

  if (phone) return "Mobile Apps";
  if (marketing) return "Website";
  if (
    claimed === "Website" ||
    claimed === "Marketing" ||
    claimed === "Branding" ||
    claimed === "Typography" ||
    claimed === "Web"
  ) {
    return "Website";
  }
  if (webProduct) return "Product Design";
  if (claimed === "Product Design") return "Website";
  if (claimed === "Mobile Apps") return null;
  return "Website";
}
