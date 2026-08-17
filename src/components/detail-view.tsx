"use client";

import { type ReactNode } from "react";
import { ExternalLink, Heart, Pencil, Trash2, X } from "lucide-react";
import type { Collection, Reference } from "@/lib/storage/types";
import { formatSavedDate } from "@/lib/utils";
import { referenceImageUrls, useObjectUrl, useThumbnailSrc } from "./hooks";
import { ImageCarousel } from "./image-carousel";
import { areaClass, GhostButton, IconButton } from "./ui";

interface DetailViewProps {
  reference: Reference;
  collectionName?: string;
  onClose: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNotes: (notes: string) => void;
  variant: "panel" | "sheet";
}

export function DetailView({
  reference,
  collectionName,
  onClose,
  onFavorite,
  onEdit,
  onDelete,
  onNotes,
  variant,
}: DetailViewProps) {
  const src = useThumbnailSrc(reference);
  const blobSrc = useObjectUrl(reference.thumbnail);
  const images = referenceImageUrls(reference);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-0.5">
          <IconButton
            label={reference.favorite ? "Unfavorite" : "Favorite"}
            onClick={onFavorite}
          >
            <Heart
              size={16}
              strokeWidth={1.75}
              fill={reference.favorite ? "currentColor" : "none"}
            />
          </IconButton>
          <IconButton label="Edit" onClick={onEdit}>
            <Pencil size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Delete" onClick={onDelete}>
            <Trash2 size={16} strokeWidth={1.75} />
          </IconButton>
        </div>
        <IconButton label="Close" onClick={onClose}>
          <X size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {images.length > 1 ? (
          <ImageCarousel
            images={images}
            alt={reference.title || "Reference"}
            primaryUrl={reference.thumbnailUrl}
            primaryBlobSrc={blobSrc}
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius)] bg-[var(--hover)]">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={reference.title || "Reference"}
                className="block h-auto w-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-[12px] text-[var(--muted-2)]">
                No image
              </div>
            )}
          </div>
        )}

        <h1 className="mt-4 text-[16px] leading-snug font-medium tracking-tight">
          {reference.title || "Untitled"}
        </h1>

        <dl className="mt-3 space-y-2 text-[13px]">
          <Row label="Source">{reference.source}</Row>
          {reference.url && (
            <Row label="URL">
              <a
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[var(--text)] underline-offset-2 hover:underline"
              >
                {reference.url}
              </a>
            </Row>
          )}
          {collectionName && <Row label="Collection">{collectionName}</Row>}
          {reference.tags.length > 0 && (
            <Row label="Tags">{reference.tags.join(", ")}</Row>
          )}
          <Row label="Saved">{formatSavedDate(reference.createdAt)}</Row>
        </dl>

        {reference.url && (
          <a
            href={reference.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--text)] text-[13px] font-medium text-white"
          >
            <ExternalLink size={14} strokeWidth={1.75} />
            Open original
          </a>
        )}

        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
            Notes
          </span>
          <textarea
            defaultValue={reference.notes}
            key={reference.id + reference.updatedAt}
            className={areaClass}
            placeholder="Add notes…"
            onBlur={(e) => {
              if (e.target.value !== reference.notes) onNotes(e.target.value);
            }}
          />
        </label>

        {variant === "sheet" && (
          <div className="mt-4 flex gap-2">
            <GhostButton className="flex-1" onClick={onEdit}>
              Edit
            </GhostButton>
            <GhostButton className="flex-1 text-[var(--danger)]" onClick={onDelete}>
              Delete
            </GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2">
      <dt className="text-[var(--muted-2)]">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function collectionNameOf(
  collections: Collection[],
  id: string | null,
) {
  if (!id) return undefined;
  return collections.find((c) => c.id === id)?.name;
}
