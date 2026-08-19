"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, isFullPageCapture } from "@/lib/utils";
import { ZoomableImage } from "./zoomable-image";

interface ImageCarouselProps {
  images: string[];
  alt: string;
  primaryUrl?: string | null;
  primaryBlobSrc?: string | null;
  cropTop?: boolean;
}

const arrowClass =
  "absolute top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/15 text-[var(--muted)] hover:bg-black/25 hover:text-[var(--text)]";

export function ImageCarousel({
  images,
  alt,
  primaryUrl,
  primaryBlobSrc,
  cropTop = false,
}: ImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const count = images.length;

  const clamped = Math.min(index, Math.max(0, count - 1));

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => {
        const next = current + delta;
        if (next < 0) return count - 1;
        if (next > count - 1) return 0;
        return next;
      });
    },
    [count],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [go]);

  if (count === 0) return null;

  const srcFor = (url: string) =>
    primaryBlobSrc && primaryUrl && url === primaryUrl ? primaryBlobSrc : url;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label={alt}
      className="group relative w-full outline-none"
    >
      <ZoomableImage
        src={srcFor(images[clamped])}
        alt={count > 1 ? `${alt} (${clamped + 1} of ${count})` : alt}
        cropTop={cropTop || isFullPageCapture(undefined, images[clamped])}
        onSwipe={count > 1 ? go : undefined}
        clickToZoom={count < 2}
      />

      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            title="Previous image"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
            className={cn(arrowClass, "left-2")}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Next image"
            title="Next image"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
            className={cn(arrowClass, "right-2")}
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>

          <div className="pointer-events-none absolute top-2 right-2 z-10 rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text)]">
            {clamped + 1} / {count}
          </div>
        </>
      )}
    </div>
  );
}
