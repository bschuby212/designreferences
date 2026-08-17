"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const emptySubscribe = () => () => {};

export function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function subscribeBreakpoint(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function getBreakpoint(): Breakpoint {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribeBreakpoint, getBreakpoint, () => "desktop");
}

export function useObjectUrl(blob: Blob | null | undefined) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

export function useThumbnailSrc(reference: {
  thumbnail: Blob | null;
  thumbnailUrl?: string | null;
}) {
  return useObjectUrl(reference.thumbnail) || reference.thumbnailUrl || null;
}

// Ordered list of image URLs for a reference. Multi-image references (e.g.
// Mobbin flows) carry every screen; single-image ones fall back to the
// thumbnail so the carousel/detail view always has something to show.
export function referenceImageUrls(reference: {
  imageUrls?: string[] | null;
  thumbnailUrl?: string | null;
}) {
  const images = (reference.imageUrls ?? []).filter(Boolean);
  if (images.length > 0) return images;
  return reference.thumbnailUrl ? [reference.thumbnailUrl] : [];
}
