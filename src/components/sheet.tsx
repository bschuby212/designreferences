"use client";

import { useEffect, useState, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsClient } from "./hooks";
import { IconButton } from "./ui";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  side: "left" | "right" | "bottom";
  title?: string;
  children: ReactNode;
  swipeToDismiss?: boolean;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  side,
  title,
  children,
  swipeToDismiss,
  className,
}: SheetProps) {
  const isClient = useIsClient();
  const [dy, setDy] = useState(0);
  const [startY, setStartY] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!isClient || !open) return null;

  const onTouchStart = (event: TouchEvent) => {
    if (!swipeToDismiss) return;
    setStartY(event.touches[0].clientY);
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!swipeToDismiss || startY == null) return;
    const delta = event.touches[0].clientY - startY;
    setDy(Math.max(0, delta));
  };
  const onTouchEnd = () => {
    if (!swipeToDismiss) return;
    if (dy > 80) onClose();
    setDy(0);
    setStartY(null);
  };

  const panel =
    side === "bottom"
      ? "sheet-bottom absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-xl bg-[var(--surface)]"
      : side === "left"
        ? "sheet-left absolute inset-y-0 left-0 flex w-[min(280px,86vw)] flex-col bg-[var(--surface)]"
        : "absolute inset-y-0 right-0 flex w-[min(420px,92vw)] flex-col bg-[var(--surface)]";

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(panel, className)}
        style={
          side === "bottom" && dy
            ? { transform: `translateY(${dy}px)` }
            : undefined
        }
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {side === "bottom" && (
          <div className="flex justify-center pt-2">
            <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
          </div>
        )}
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3">
            <h2 className="truncate text-[13px] font-medium">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} strokeWidth={1.75} />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const isClient = useIsClient();
  if (!isClient || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[94dvh] w-full max-w-md flex-col rounded-t-xl bg-[var(--surface)] sm:rounded-xl",
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3">
            <h2 className="truncate text-[13px] font-medium">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} strokeWidth={1.75} />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
