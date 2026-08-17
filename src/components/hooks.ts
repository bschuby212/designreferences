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
