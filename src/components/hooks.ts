"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

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
  const [url, setUrl] = useState<string | null>(null);
  // Create and revoke the URL inside the same effect. Doing this via useMemo
  // breaks under React Strict Mode: the effect cleanup revokes the URL, but the
  // memo isn't recomputed on the re-mount, leaving a dead (revoked) URL.
  useEffect(() => {
    if (!blob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
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
