"use client";

import { useState, type ReactNode } from "react";
import {
  ExternalLink,
  Heart,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Reference } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { ReferenceCarousel } from "./reference-carousel";
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
  const [menu, setMenu] = useState(false);
  const menuRef = useClickOutside(menu, () => setMenu(false));

  return (
    <article className="group relative mb-0 break-inside-avoid">
      <ReferenceCarousel
        screens={reference.screens}
        aspect={reference.aspect}
        title={reference.title || "Reference"}
        variant="card"
        onActivate={onOpen}
      />

      {/* Pointer devices get the inline row on hover. */}
      <div className="pointer-events-none absolute top-1.5 right-1.5 z-30 hidden gap-0.5 rounded-md bg-[var(--surface)]/92 p-0.5 opacity-0 shadow-sm ring-1 ring-[var(--border)] transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 [@media(hover:hover)]:flex">
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
        <Action label="Delete" onClick={onDelete}>
          <Trash2 size={14} strokeWidth={1.75} />
        </Action>
      </div>

      {/* Touch devices cannot hover, so the same actions live behind a tap. */}
      <div
        ref={menuRef}
        className="absolute top-1.5 right-1.5 z-30 [@media(hover:hover)]:hidden"
      >
        <button
          type="button"
          aria-label="Reference actions"
          aria-expanded={menu}
          className="grid h-8 w-8 place-items-center rounded-md bg-[var(--surface)]/92 text-[var(--muted)] shadow-sm ring-1 ring-[var(--border)]"
          onClick={(event) => {
            event.stopPropagation();
            setMenu((open) => !open);
          }}
        >
          <MoreHorizontal size={15} />
        </button>
        {menu && (
          <div className="absolute right-0 top-9 z-40 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 shadow-md">
            <MenuItem
              onClick={() => {
                setMenu(false);
                onFavorite();
              }}
            >
              <Heart
                size={14}
                fill={reference.favorite ? "currentColor" : "none"}
              />
              {reference.favorite ? "Remove favorite" : "Add favorite"}
            </MenuItem>
            {reference.url && (
              <a
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 w-full items-center gap-2 px-3 text-left text-[13px] hover:bg-[var(--hover)]"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenu(false);
                }}
              >
                <ExternalLink size={14} /> Open original
              </a>
            )}
            <MenuItem
              onClick={() => {
                setMenu(false);
                onEdit();
              }}
            >
              <Pencil size={14} /> Edit
            </MenuItem>
            <MenuItem
              danger
              onClick={() => {
                setMenu(false);
                onDelete();
              }}
            >
              <Trash2 size={14} /> Delete
            </MenuItem>
          </div>
        )}
      </div>

      {compactMeta && (
        <div className="mt-1 flex items-start justify-between gap-2 px-0.5">
          <div className="min-w-0">
            {reference.title ? (
              <div className="truncate text-[12px] leading-tight">
                {reference.title}
              </div>
            ) : null}
            <div className="truncate text-[10px] text-[var(--muted-2)]">
              {reference.source} · {reference.screens.length} screens
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

function MenuItem({
  children,
  danger,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-11 w-full items-center gap-2 px-3 text-left text-[13px] hover:bg-[var(--hover)]",
        danger && "text-[var(--danger)] hover:bg-[var(--danger-bg)]",
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
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
      className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
