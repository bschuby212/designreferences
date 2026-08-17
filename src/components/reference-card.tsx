"use client";

import { useState, type ReactNode } from "react";
import {
  ExternalLink,
  Heart,
  Images,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Reference } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { referenceImageUrls, useThumbnailSrc } from "./hooks";
import { useClickOutside } from "./ui";

interface ReferenceCardProps {
  reference: Reference;
  compactMeta?: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ReferenceCard({
  reference,
  compactMeta,
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
}: ReferenceCardProps) {
  const src = useThumbnailSrc(reference);
  const imageCount = referenceImageUrls(reference).length;
  const [menu, setMenu] = useState(false);
  const menuRef = useClickOutside(menu, () => setMenu(false));

  return (
    <article className="group relative mb-0 break-inside-avoid">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full overflow-hidden rounded-[var(--radius)] bg-[var(--hover)] text-left"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={reference.title || "Reference"}
            className="block h-auto w-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-[11px] text-[var(--muted-2)]">
            No image
          </div>
        )}
      </button>

      {imageCount > 1 && (
        <div className="pointer-events-none absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
          <Images size={11} strokeWidth={2} />
          {imageCount}
        </div>
      )}

      <div className="pointer-events-none absolute top-1.5 right-1.5 hidden gap-0.5 rounded-md bg-[var(--surface)]/92 p-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:hover)]:flex">
        <Action
          label={reference.favorite ? "Unfavorite" : "Favorite"}
          onClick={onFavorite}
        >
          <Heart
            size={14}
            strokeWidth={1.75}
            fill={reference.favorite ? "currentColor" : "none"}
          />
        </Action>
        {reference.url && (
          <a
            href={reference.url}
            target="_blank"
            rel="noreferrer"
            aria-label="Open original"
            title="Open original"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} strokeWidth={1.75} />
          </a>
        )}
        <Action label="Edit" onClick={onEdit}>
          <Pencil size={14} strokeWidth={1.75} />
        </Action>
        <div className="relative" ref={menuRef}>
          <Action
            label="More"
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal size={14} />
          </Action>
          {menu && (
            <div className="absolute right-0 top-9 z-20 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-sm">
              <button
                type="button"
                className="flex h-10 w-full items-center gap-2 px-3 text-left text-[13px] text-[var(--danger)] hover:bg-[var(--danger-bg)]"
                onClick={() => {
                  setMenu(false);
                  onDelete();
                }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {compactMeta && (
        <div className="mt-1.5 flex items-start justify-between gap-2 px-0.5">
          <div className="min-w-0">
            {reference.title ? (
              <div className="truncate text-[12px] leading-tight">
                {reference.title}
              </div>
            ) : null}
            <div className="truncate text-[10px] text-[var(--muted-2)]">
              {reference.source}
            </div>
          </div>
          {reference.favorite && (
            <Heart
              size={12}
              className="mt-0.5 shrink-0 text-[var(--text)]"
              fill="currentColor"
            />
          )}
        </div>
      )}
    </article>
  );
}

function Action({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
