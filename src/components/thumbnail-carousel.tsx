"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, isMotionSrc } from "@/lib/utils";

export type ThumbFrame = "phone" | "wide";

interface ThumbnailCarouselProps {
  images: string[];
  alt: string;
  pageUrl: string;
  onOpen: () => void;
  cropTop?: boolean;
  frame?: ThumbFrame;
  videoUrl?: string | null;
  /** Keep cycling without hover (motion collection stills). */
  autoPlay?: boolean;
}

const arrowClass =
  "absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[var(--text)] shadow-sm ring-1 ring-black/8 hover:bg-[var(--hover)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/thumb:opacity-100";

function wellClass(frame: ThumbFrame) {
  return frame === "phone" ? "aspect-[383/852]" : "aspect-[4/3]";
}

export function ThumbnailCarousel({
  images,
  alt,
  pageUrl,
  onOpen,
  cropTop = false,
  frame = "wide",
  videoUrl = null,
  autoPlay = false,
}: ThumbnailCarouselProps) {
  const motion = videoUrl || images.find((url) => isMotionSrc(url)) || null;
  const slides = images.filter(Boolean);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const clamped = Math.min(index, Math.max(0, count - 1));
  const cycling = !motion && count >= 2 && (hovering || autoPlay) && !dragging;

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
    if (!cycling) return;
    const timer = window.setInterval(() => go(1), autoPlay ? 1100 : 1400);
    return () => window.clearInterval(timer);
  }, [cycling, autoPlay, go]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (motion || count < 2) return;
    start.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const origin = start.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    setDragX(dx);
  };

  const endDrag = () => {
    const width = viewportRef.current?.clientWidth ?? 1;
    const dx = dragX;
    start.current = null;
    setDragging(false);
    setDragX(0);
    if (swiped.current && Math.abs(dx) > Math.min(40, width * 0.18)) {
      go(dx < 0 ? 1 : -1);
    }
    queueMicrotask(() => {
      swiped.current = false;
    });
  };

  if (count === 0 && !motion) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-2xl bg-white text-[11px] text-[var(--muted-2)]",
          wellClass(frame),
        )}
      >
        No image
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className={cn(
        "group/thumb relative w-full touch-pan-y overflow-hidden rounded-2xl bg-white p-3",
        wellClass(frame),
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={() => setHovering(true)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        if (!autoPlay) setIndex(0);
      }}
      onClick={() => {
        if (swiped.current) return;
        onOpen();
      }}
    >
      {motion ? (
        <MotionThumb src={motion} alt={alt} cropTop={cropTop} frame={frame} />
      ) : (
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(${-clamped * 100}% + ${dragX}px))`,
            transition: dragging ? "none" : "transform 280ms ease-out",
          }}
        >
          {slides.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="relative flex h-full w-full shrink-0 grow-0 basis-full items-center justify-center overflow-hidden"
            >
              <ThumbImage
                url={url}
                pageUrl={pageUrl}
                alt={count > 1 ? `${alt} (${i + 1} of ${count})` : alt}
                eager={Math.abs(i - clamped) <= 1}
                cropTop={cropTop}
                frame={frame}
              />
            </div>
          ))}
        </div>
      )}

      {!motion && count > 1 && (
        <>
          <div className="pointer-events-none absolute top-3 right-3 z-10 flex gap-1">
            {slides.slice(0, 8).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 w-1 rounded-full",
                  i === clamped ? "bg-black/45" : "bg-black/15",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Previous screen"
            title="Previous screen"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              go(-1);
            }}
            className={cn(arrowClass, "left-2")}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Next screen"
            title="Next screen"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
            className={cn(arrowClass, "right-2")}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}

function mediaClass(cropTop: boolean, frame: ThumbFrame) {
  return cn(
    "max-h-full max-w-full select-none rounded-xl shadow-[0_1px_2px_rgba(24,24,27,0.06)]",
    cropTop
      ? "h-full w-full object-cover object-top"
      : "h-full w-full object-contain object-center",
    frame === "phone" && !cropTop && "rounded-2xl",
  );
}

function MotionThumb({
  src,
  alt,
  cropTop,
  frame,
}: {
  src: string;
  alt: string;
  cropTop: boolean;
  frame: ThumbFrame;
}) {
  const className = mediaClass(cropTop, frame);
  if (/\.gif(\?|$)/i.test(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={className} draggable={false} />
    );
  }
  return (
    <video
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
    />
  );
}

function ThumbImage({
  url,
  pageUrl,
  alt,
  eager,
  cropTop,
  frame,
}: {
  url: string;
  pageUrl: string;
  alt: string;
  eager: boolean;
  cropTop: boolean;
  frame: ThumbFrame;
}) {
  const fallback =
    /\/content\/app_screens\//i.test(url) || /mobbin\.com/i.test(pageUrl)
      ? null
      : `https://s.wordpress.com/mshots/v1/${encodeURIComponent(pageUrl)}?w=1440&h=1080`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={url}
      src={url}
      alt={alt}
      draggable={false}
      loading={eager ? "eager" : "lazy"}
      referrerPolicy="no-referrer"
      onError={(event) => {
        if (!fallback) return;
        const img = event.currentTarget;
        if (img.dataset.fallbackApplied === "1") return;
        img.dataset.fallbackApplied = "1";
        img.src = fallback;
      }}
      className={mediaClass(cropTop, frame)}
    />
  );
}
