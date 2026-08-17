"use client";

import { useState, type ReactNode } from "react";
import {
  ExternalLink,
  Folder,
  Heart,
  Images,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import type { Reference } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { referenceImageUrls, useThumbnailSrc } from "./hooks";
import { useClickOutside } from "./ui";

interface ReferenceCardProps {
  reference: Reference;
  collectionName?: string;
  onOpen: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSelectCollection?: (id: string) => void;
  onSelectTag?: (tag: string) => void;
}

export function ReferenceCard({
  reference,
  collectionName,
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
  onSelectCollection,
  onSelectTag,
}: ReferenceCardProps) {
  const src = useThumbnailSrc(reference);
  const imageCount = referenceImageUrls(reference).length;
  const [menu, setMenu] = useState(false);
  const menuRef = useClickOutside(menu, () => setMenu(false));

  const chips: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
  }> = [];
  if (collectionName && reference.collectionId && onSelectCollection) {
    const id = reference.collectionId;
    chips.push({
      key: `c-${id}`,
      label: collectionName,
      icon: <Folder size={11} strokeWidth={1.75} />,
      onClick: () => onSelectCollection(id),
    });
  }
  for (const tag of reference.tags) {
    if (chips.length >= 3) break;
    chips.push({
      key: `t-${tag}`,
      label: tag,
      icon: <Tag size={11} strokeWidth={1.75} />,
      onClick: () => onSelectTag?.(tag),
    });
  }

  return (
    <article className="group relative mb-0 flex break-inside-avoid flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--card-border)] bg-[var(--card)] transition-shadow hover:shadow-[0_1px_2px_rgba(24,24,27,0.06),0_8px_24px_rgba(24,24,27,0.06)]">
      <div className="relative p-1.5">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full overflow-hidden rounded-[calc(var(--radius)-4px)] bg-[var(--hover)] text-left"
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
          <div className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
            <Images size={11} strokeWidth={2} />
            {imageCount}
          </div>
        )}

        <div className="pointer-events-none absolute top-3 right-3 hidden gap-0.5 rounded-md bg-[var(--surface)]/92 p-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] backdrop-blur transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:hover)]:flex">
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
            <Action label="More" onClick={() => setMenu((v) => !v)}>
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
      </div>

      <div className="flex min-w-0 flex-col gap-2 px-3 pt-1 pb-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left text-[12.5px] leading-tight font-medium text-[var(--text)]"
        >
          <span className="line-clamp-1">{reference.title || "Untitled"}</span>
        </button>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  chip.onClick();
                }}
                className="inline-flex h-6 max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] pr-2 pl-1.5 text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              >
                <span className="shrink-0 text-[var(--muted-2)]">{chip.icon}</span>
                <span className="truncate">{chip.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
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
