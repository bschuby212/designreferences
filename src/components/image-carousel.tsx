"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageCarouselProps {
  images: string[];
  alt: string;
  // Cached bytes for the primary image, matched to `primaryUrl`, so the first
  // (already-fetched) screen renders crisply and offline.
  primaryUrl?: string | null;
  primaryBlobSrc?: string | null;
}

export function ImageCarousel({
  images,
  alt,
  primaryUrl,
  primaryBlobSrc,
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
      className="group relative w-full overflow-hidden rounded-[var(--radius)] bg-[var(--hover)] outline-none"
    >
      <div
        className="flex h-[52vh] transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${clamped * 100}%)` }}
      >
        {images.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${i}`}
            src={srcFor(url)}
            alt={count > 1 ? `${alt} (${i + 1} of ${count})` : alt}
            className="block h-full w-full shrink-0 grow-0 basis-full object-contain"
            referrerPolicy="no-referrer"
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <CarouselButton
            side="left"
            label="Previous image"
            onClick={() => go(-1)}
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </CarouselButton>
          <CarouselButton
            side="right"
            label="Next image"
            onClick={() => go(1)}
          >
            <ChevronRight size={18} strokeWidth={2} />
          </CarouselButton>

          <div className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {clamped + 1} / {count}
          </div>

          {count <= 12 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
              {images.map((url, i) => (
                <button
                  key={`dot-${url}-${i}`}
                  type="button"
                  aria-label={`Go to image ${i + 1}`}
                  aria-current={i === clamped}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "pointer-events-auto h-1.5 rounded-full bg-white/60 transition-all",
                    i === clamped ? "w-4 bg-white" : "w-1.5 hover:bg-white/80",
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CarouselButton({
  side,
  label,
  onClick,
  children,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {children}
    </button>
  );
}
