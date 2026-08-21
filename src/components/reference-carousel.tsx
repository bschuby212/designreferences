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

/** Outer gray preview size. Slide height stays fixed while paging. */
const CARD_RATIO: Record<Aspect, string> = {
  portrait: "3 / 4",
  landscape: "16 / 10",
};

const DETAIL_RATIO: Record<Aspect, string> = {
  portrait: "9 / 16",
  landscape: "4 / 3",
};

/** Natural iPhone capture (1290×2796). Used only for Mobile Apps. */
const PHONE_RATIO = "9 / 19.5";

const SWIPE_PX = 32;
const SWIPE_CLICK_MS = 350;

interface ReferenceCarouselProps {
  screens: ReferenceScreen[];
  aspect: Aspect | null;
  title: string;
  /** "card" adds a transparent open target underneath the controls. */
  variant: "card" | "detail";
  /** Dashboards drop the tall laptop plate; phone uses a portrait device well. */
  fit?: "default" | "dashboard" | "phone";
  /** Desktop modal: fill the grey pane instead of a framed aspect-ratio plate. */
  bleed?: boolean;
  onActivate?: () => void;
  className?: string;
}

export function ReferenceCarousel({
  screens,
  aspect,
  title,
  variant,
  fit = "default",
  bleed = false,
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
  const kind: Aspect = aspect ?? "landscape";
  const phone = fit === "phone" && kind === "portrait";

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

  // Cards keep the shared 3:4 well so product UI stays thumbnail-sized.
  // The modal/sheet uses the natural phone ratio for inspection.
  const ratio = card
    ? CARD_RATIO[kind]
    : phone
      ? PHONE_RATIO
      : DETAIL_RATIO[kind];
  const card = variant === "card";
  const fill = !card && bleed;

  if (count === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-[11px] text-[var(--muted-2)]",
          card
            ? "rounded-[24px] bg-[var(--preview)]"
            : fill
              ? "h-full w-full"
              : "rounded-[var(--radius)] bg-[var(--hover)]",
          className,
        )}
        style={fill ? undefined : { aspectRatio: ratio }}
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
    "absolute top-1/2 z-20 grid -translate-y-1/2 place-items-center rounded-full bg-[var(--surface)] text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]",
    variant === "detail" ? "h-9 w-9" : "h-7 w-7",
  );

  return (
    <div
      className={cn("group/carousel relative", fill && "h-full w-full", className)}
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
        className={cn(
          "relative overflow-hidden",
          card
            ? "rounded-[24px] bg-[var(--preview)]"
            : fill
              ? "h-full w-full"
              : "rounded-[var(--radius)] bg-[var(--hover)]",
        )}
        style={fill ? undefined : { aspectRatio: ratio }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
        >
          {screens.map((screen, position) => (
            <div
              key={screen.src}
              className={cn(
                "h-full w-full shrink-0",
                fill &&
                  (phone
                    ? "flex items-center justify-center px-8 py-6"
                    : "flex items-center justify-center p-16"),
                card &&
                  kind === "portrait" &&
                  "flex items-center justify-center px-5 py-6",
                card &&
                  kind === "landscape" &&
                  (fit === "dashboard"
                    ? "flex items-center justify-center px-4 py-10"
                    : "flex items-center justify-center px-6 py-12"),
                !card &&
                  !fill &&
                  phone &&
                  "flex items-center justify-center p-4",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screen.src}
                alt={`${title} — ${screen.label}`}
                className={cn(
                  "select-none object-contain object-center",
                  card && kind === "portrait"
                    ? "max-h-full max-w-full rounded-[22px]"
                    : card
                      ? "max-h-full max-w-full rounded-[14px]"
                      : fill || phone
                        ? "max-h-full max-w-full"
                        : "h-full w-full",
                )}
                draggable={false}
                loading={position === 0 ? "eager" : "lazy"}
                decoding="async"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>

        {/* Open target sits under the controls: siblings declared after it
            receive the pointer events instead. */}
        {card && onActivate && (
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
              className={cn(arrowClass, variant === "detail" ? "left-2" : "left-1.5")}
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
              className={cn(arrowClass, variant === "detail" ? "right-2" : "right-1.5")}
              onClick={(event) => {
                event.stopPropagation();
                go(index + 1);
              }}
            >
              <ChevronRight size={arrowSize} strokeWidth={2} />
            </button>

            <div
              className={cn(
                "pointer-events-none absolute top-1.5 z-20 rounded-full bg-[var(--text)]/75 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white",
                variant === "detail" ? "right-2 top-2" : "left-2",
              )}
            >
              {index + 1}/{count}
            </div>

            {phone && (
              <div
                className={cn(
                  "absolute z-20 flex max-w-[80%] items-center justify-center",
                  variant === "detail" ? "bottom-2 left-1/2 -translate-x-1/2" : "bottom-1 left-1/2 -translate-x-1/2",
                )}
              >
                {screens.map((_, position) => (
                  <button
                    key={screens[position].src}
                    type="button"
                    aria-label={`Show screen ${position + 1}`}
                    aria-current={position === index ? "true" : undefined}
                    className="grid h-7 w-7 place-items-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      go(position);
                    }}
                  >
                    <span
                      className={cn(
                        "h-1.5 rounded-full transition-[width,background-color]",
                        position === index
                          ? "w-4 bg-[var(--text)]"
                          : "w-1.5 bg-[var(--text)]/25",
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
