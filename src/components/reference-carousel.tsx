"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Aspect, ReferenceScreen } from "@/lib/storage/types";
import { cn } from "@/lib/utils";

/** Frame ratios keep the card height identical on every slide. */
const RATIO: Record<Aspect, string> = {
  portrait: "9 / 19.5",
  landscape: "16 / 10",
};

const SWIPE_PX = 32;
const SWIPE_CLICK_MS = 350;

interface ReferenceCarouselProps {
  screens: ReferenceScreen[];
  aspect: Aspect | null;
  title: string;
  /** "card" adds a transparent open target underneath the controls. */
  variant: "card" | "detail";
  onActivate?: () => void;
  className?: string;
}

export function ReferenceCarousel({
  screens,
  aspect,
  title,
  variant,
  onActivate,
  className,
}: ReferenceCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = screens.length;
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<"none" | "x" | "y">("none");
  // Time of the last swipe rather than a boolean: a flag that outlives the
  // gesture ends up swallowing a later tap that was meant to open the card.
  const swipedAt = useRef(0);

  // Compare the screens themselves rather than the array identity: the live
  // query hands back a fresh array on every write, and resetting to the first
  // slide because someone favourited the card would be wrong.
  const signature = useMemo(
    () => screens.map((screen) => screen.src).join("|"),
    [screens],
  );
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setIndex(0);
  }

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const ratio = RATIO[aspect ?? "landscape"];

  if (count === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[var(--radius)] bg-[var(--hover)] text-[11px] text-[var(--muted-2)]",
          className,
        )}
        style={{ aspectRatio: ratio }}
      >
        No screens
      </div>
    );
  }

  const onTouchStart = (event: ReactTouchEvent) => {
    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
    axis.current = "none";
  };

  const onTouchMove = (event: ReactTouchEvent) => {
    if (!start.current || count < 2) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.current.x;
    const dy = touch.clientY - start.current.y;
    if (axis.current === "none" && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    // A horizontal drag belongs to the carousel. Stop it here so the bottom
    // sheet's vertical swipe-to-dismiss never sees it.
    if (axis.current === "x") event.stopPropagation();
  };

  const onTouchEnd = (event: ReactTouchEvent) => {
    if (!start.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.current.x;
    if (axis.current === "x" && Math.abs(dx) > SWIPE_PX) {
      swipedAt.current = Date.now();
      go(index + (dx < 0 ? 1 : -1));
    }
    start.current = null;
    axis.current = "none";
  };

  const arrowSize = variant === "detail" ? 18 : 15;
  const arrowClass = cn(
    "absolute top-1/2 z-20 grid -translate-y-1/2 place-items-center rounded-full bg-[var(--surface)]/85 text-[var(--text)] shadow-sm ring-1 ring-[var(--border)] backdrop-blur transition-opacity",
    variant === "detail" ? "h-9 w-9" : "h-7 w-7",
    // Visible by default on touch devices; on pointer devices they fade in
    // with the card so the grid stays calm.
    "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100",
  );

  return (
    <div
      className={cn("group/carousel relative", className)}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${title}: ${count} screens`}
      onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          go(index + 1);
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(index - 1);
        }
      }}
    >
      <div
        className="relative overflow-hidden rounded-[var(--radius)] bg-[var(--hover)]"
        style={{ aspectRatio: ratio }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {screens.map((screen, position) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={screen.src}
              src={screen.src}
              alt={`${title} — ${screen.label}`}
              className="h-full w-full shrink-0 select-none object-contain"
              draggable={false}
              loading={position === 0 ? "eager" : "lazy"}
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ))}
        </div>

        {/* Open target sits under the controls: siblings declared after it
            receive the pointer events instead. */}
        {variant === "card" && onActivate && (
          <button
            type="button"
            aria-label={`Open ${title}`}
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={() => {
              // Ignore only the click a browser synthesises at the end of a
              // swipe, not every click after one.
              if (Date.now() - swipedAt.current < SWIPE_CLICK_MS) return;
              onActivate();
            }}
          />
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous screen"
              className={cn(arrowClass, variant === "detail" ? "left-2" : "left-1")}
              onClick={(event) => {
                event.stopPropagation();
                go(index - 1);
              }}
            >
              <ChevronLeft size={arrowSize} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next screen"
              className={cn(arrowClass, variant === "detail" ? "right-2" : "right-1")}
              onClick={(event) => {
                event.stopPropagation();
                go(index + 1);
              }}
            >
              <ChevronRight size={arrowSize} strokeWidth={2} />
            </button>

            {/* On cards the top-right corner belongs to the row of actions. */}
            <div
              className={cn(
                "pointer-events-none absolute top-1.5 z-20 rounded-full bg-[var(--text)]/75 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white",
                variant === "detail" ? "right-2 top-2" : "left-1.5",
              )}
            >
              {index + 1}/{count}
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-1.5 flex items-center justify-center gap-1">
          {screens.map((screen, position) => (
            <button
              key={screen.src}
              type="button"
              aria-label={`Show screen ${position + 1}`}
              aria-current={position === index}
              className="grid h-6 w-5 place-items-center"
              onClick={(event) => {
                event.stopPropagation();
                go(position);
              }}
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  position === index
                    ? "w-4 bg-[var(--text)]"
                    : "w-1.5 bg-[var(--border-strong)]",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
