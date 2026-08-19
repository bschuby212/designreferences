"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZoomableImageProps {
  src: string;
  alt: string;
  /** Tall full-page captures: start at one screen (top) and allow pan. */
  cropTop?: boolean;
  onSwipe?: (direction: -1 | 1) => void;
  /** Tap image to zoom. Off for carousels so swipe/arrows own the gesture. */
  clickToZoom?: boolean;
}

const controlClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-[var(--muted)] hover:bg-black/25 hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-0";

export function ZoomableImage(props: ZoomableImageProps) {
  return <ZoomableImageInner key={`${props.src}|${props.cropTop ? "top" : "fit"}`} {...props} />;
}

function ZoomableImageInner({
  src,
  alt,
  cropTop = false,
  onSwipe,
  clickToZoom = true,
}: ZoomableImageProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [userScale, setUserScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [fit, setFit] = useState(1);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: boolean;
    dx: number;
    dy: number;
  } | null>(null);

  const measure = useCallback(() => {
    const vp = viewportRef.current;
    const img = imgRef.current;
    if (!vp || !img?.naturalWidth) return;
    const contain = Math.min(
      vp.clientWidth / img.naturalWidth,
      vp.clientHeight / img.naturalHeight,
    );
    const widthFit = vp.clientWidth / img.naturalWidth;
    setFit(cropTop ? widthFit : contain);
    setReady(true);
  }, [cropTop]);

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) measure();
    const vp = viewportRef.current;
    if (!vp) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(vp);
    return () => observer.disconnect();
  }, [measure, src]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const next = clampScale(userScale + (event.deltaY < 0 ? 0.25 : -0.25));
      setUserScale(next);
      if (next <= 1 && !cropTop) {
        setTx(0);
        setTy(0);
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [cropTop, userScale]);

  const scale = fit * userScale;
  const canPan = cropTop || userScale > 1;

  const zoomTo = (next: number) => {
    const value = clampScale(next);
    setUserScale(value);
    if (value <= 1 && !cropTop) {
      setTx(0);
      setTy(0);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      tx,
      ty,
      moved: false,
      dx: 0,
      dy: 0,
    };
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start.dx = dx;
    start.dy = dy;
    if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
    const swiping =
      Boolean(onSwipe) && userScale <= 1 && Math.abs(dx) > Math.abs(dy);
    if (swiping || !canPan) return;
    setTx(start.tx + dx);
    setTy(start.ty + dy);
  };

  const endDrag = () => {
    const start = drag.current;
    drag.current = null;
    setDragging(false);
    if (
      start &&
      onSwipe &&
      userScale <= 1 &&
      Math.abs(start.dx) > 48 &&
      Math.abs(start.dx) > Math.abs(start.dy)
    ) {
      onSwipe(start.dx < 0 ? 1 : -1);
      return;
    }
    if (start?.moved) return;
    if (!clickToZoom) return;
    if (userScale <= 1) zoomTo(2);
    else zoomTo(1);
  };

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        className={cn(
          "flex h-[min(70vh,640px)] min-h-[240px] touch-none overflow-hidden bg-[var(--surface)]",
          cropTop ? "items-start justify-center" : "items-center justify-center",
          canPan ? "cursor-grab" : clickToZoom ? "cursor-zoom-in" : "cursor-default",
          dragging && "cursor-grabbing",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={measure}
          className="max-w-none select-none"
          style={{
            opacity: ready ? 1 : 0,
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: cropTop ? "top center" : "center center",
            transition: dragging ? "none" : "transform 160ms ease-out, opacity 120ms ease-out",
          }}
        />
      </div>
      {ready ? (
        <div
          className="absolute right-2 bottom-2 z-20 flex gap-1"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          {userScale > 1 ? (
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={(event) => {
                event.stopPropagation();
                zoomTo(userScale - 0.5);
              }}
              className={controlClass}
            >
              <ZoomOut size={15} strokeWidth={2} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={(event) => {
              event.stopPropagation();
              zoomTo(userScale + 0.5);
            }}
            disabled={userScale >= 4}
            className={controlClass}
          >
            <ZoomIn size={15} strokeWidth={2} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function clampScale(value: number) {
  return Math.min(4, Math.max(1, Math.round(value * 10) / 10));
}
