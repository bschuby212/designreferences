import {
  CANONICAL_NAV_COLLECTIONS,
  HIDDEN_NAV_COLLECTIONS,
} from "@/lib/storage/types";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function uid() {
  return crypto.randomUUID();
}

export function now() {
  return Date.now();
}

export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).toString();
  } catch {
    return "";
  }
}

/** Stable id for a Mobbin/CDN screenshot so clones with different query params collapse. */
export function imageAssetKey(url: string | null | undefined) {
  if (!url) return "";
  const asset = url.match(/\/(?:app_screens|sites)\/([0-9a-f-]{36})/i);
  if (asset) return asset[1].toLowerCase();
  const short = url.match(/\/mcp\/short\/([A-Za-z0-9]+)/);
  if (short) return `short:${short[1]}`;
  return normalizeUrl(url);
}

export function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isHiddenNavCollection(name: string) {
  return (HIDDEN_NAV_COLLECTIONS as readonly string[]).includes(name);
}

export function isCanonicalNavCollection(name: string) {
  return (CANONICAL_NAV_COLLECTIONS as readonly string[]).includes(name);
}

/** Display-only product name. Stored titles stay unchanged for search. */
export function productName(title: string) {
  const cleaned = title
    .replace(/\s+(iOS|Android|Web)\b[\s\S]*$/i, "")
    .replace(/\s+section$/i, "")
    .trim();
  return cleaned || title.trim() || "Untitled";
}

export function formatSavedDate(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

export function isMobbinFlow(url?: string | null) {
  return /mobbin\.com\/(?:explore\/)?flows\//i.test(url ?? "");
}

/** Full-page marketing captures (Mobbin sections/sites) vs a single UI screen. */
export function isFullPageCapture(url?: string | null, imageUrl?: string | null) {
  const haystack = `${url ?? ""} ${imageUrl ?? ""}`;
  return /\/sections\//i.test(haystack) || /\/content\/sites\//i.test(haystack);
}

export function isPhoneShot(url?: string | null, imageUrl?: string | null) {
  const haystack = `${url ?? ""} ${imageUrl ?? ""}`;
  return (
    /\/content\/app_screens\//i.test(haystack) ||
    /mobbin\.com\/(?:explore\/)?flows\//i.test(haystack)
  );
}

/** Phone-shaped card well (383×852). Web/desktop always uses 4:3. */
export function isPhoneFrame(
  collectionName?: string | null,
  url?: string | null,
  imageUrl?: string | null,
) {
  if (collectionName === "Mobile Apps" || collectionName === "Onboarding") {
    return true;
  }
  if (collectionName === "Navigation" || collectionName === "Motion") {
    return isPhoneShot(url, imageUrl);
  }
  return false;
}

/** First-viewport crop for full-page website captures (1440×1080 / 4:3). */
export function heroShotUrl(url: string) {
  if (/\/content\/sites\//i.test(url)) {
    const base = url.replace(/\?.*$/, "");
    return `${base}?f=png&w=1440&h=1080&q=70&fit=crop&crop=top`;
  }
  if (/s\.wordpress\.com\/mshots\/v1\//i.test(url)) {
    const base = url.replace(/\?.*$/, "");
    return `${base}?w=1440&h=1080`;
  }
  return url;
}

export function isEncryptedCdn(url: string) {
  return /file\.webp\?enc=/i.test(url);
}

export function isMotionSrc(url?: string | null) {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|gif)(\?|$)/i.test(url);
}

export function base64ToBlob(data: string, mime: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "image/jpeg" });
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
