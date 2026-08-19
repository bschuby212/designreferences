"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, Heart, Pencil, Send, Trash2, X } from "lucide-react";
import type { Collection, Reference } from "@/lib/storage/types";
import { cleanDesignTitle } from "@/lib/storage/product-tags";
import { formatSavedDate, heroShotUrl, isMotionSrc, isPhoneFrame } from "@/lib/utils";
import { CollectionChip, CompanyHeading } from "./category-icons";
import { referenceImageUrls, useObjectUrl, useThumbnailSrc } from "./hooks";
import { ImageCarousel } from "./image-carousel";
import { areaClass, IconButton } from "./ui";
import { ZoomableImage } from "./zoomable-image";

interface DetailViewProps {
  reference: Reference;
  collectionName?: string;
  onClose: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNotes: (notes: string) => void;
  onAddComment: (text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSelectCollection?: (id: string) => void;
}

export function DetailView({
  reference,
  collectionName,
  onClose,
  onFavorite,
  onEdit,
  onDelete,
  onNotes,
  onAddComment,
  onDeleteComment,
  onSelectCollection,
}: DetailViewProps) {
  const src = useThumbnailSrc(reference);
  const blobSrc = useObjectUrl(reference.thumbnail);
  const images = referenceImageUrls(reference).map(heroShotUrl);
  const videoUrl = reference.videoUrl || images.find((url) => isMotionSrc(url)) || null;
  const [comment, setComment] = useState("");
  const phone = isPhoneFrame(collectionName, reference.url, src);
  const cropTop = !phone;
  const displaySrc = phone ? src : images[0] || src;

  const submitComment = () => {
    const text = comment.trim();
    if (!text) return;
    onAddComment(text);
    setComment("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-2 py-1.5">
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div>
          {videoUrl ? (
            <div className="overflow-hidden bg-[var(--surface)]">
              {/\.gif(\?|$)/i.test(videoUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={videoUrl}
                  alt={cleanDesignTitle(reference.title) || "Reference"}
                  className="max-h-[min(70vh,640px)] w-full object-contain object-top"
                />
              ) : (
                <video
                  src={videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="max-h-[min(70vh,640px)] w-full object-contain object-top"
                />
              )}
            </div>
          ) : images.length > 1 ? (
            <ImageCarousel
              images={images}
              alt={cleanDesignTitle(reference.title) || "Reference"}
              primaryUrl={phone ? reference.thumbnailUrl : null}
              primaryBlobSrc={phone ? blobSrc : null}
              cropTop={cropTop}
            />
          ) : displaySrc ? (
            <ZoomableImage
              src={displaySrc}
              alt={cleanDesignTitle(reference.title) || "Reference"}
              cropTop={cropTop}
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center text-[12px] text-[var(--muted-2)]">
              No image
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                <CompanyHeading
                  name={cleanDesignTitle(reference.title) || "Untitled"}
                />
                {collectionName ? (
                  <CollectionChip
                    name={collectionName}
                    onClick={
                      reference.collectionId && onSelectCollection
                        ? () => onSelectCollection(reference.collectionId as string)
                        : undefined
                    }
                  />
                ) : null}
              </div>
              <div className="mt-1 text-[12px] text-[var(--muted-2)]">
                {reference.source} · Saved {formatSavedDate(reference.createdAt)}
              </div>
            </div>
            {reference.url && (
              <a
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--text)] px-3 text-[12px] font-medium text-white"
              >
                <ExternalLink size={13} strokeWidth={1.75} />
                Open
              </a>
            )}
          </div>

          <Section label="Description">
            <textarea
              defaultValue={reference.notes}
              key={reference.id + reference.updatedAt}
              className={areaClass}
              placeholder="Add a description…"
              onBlur={(e) => {
                if (e.target.value !== reference.notes) onNotes(e.target.value);
              }}
            />
          </Section>

          <Section label={`Comments${reference.comments.length ? ` (${reference.comments.length})` : ""}`}>
            <div className="flex flex-col gap-2">
              {reference.comments.length === 0 && (
                <p className="text-[12px] text-[var(--muted-2)]">
                  No comments yet.
                </p>
              )}
              {reference.comments.map((item) => (
                <div
                  key={item.id}
                  className="group/comment rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[13px] whitespace-pre-wrap break-words text-[var(--text)]">
                      {item.text}
                    </p>
                    <button
                      type="button"
                      aria-label="Delete comment"
                      title="Delete comment"
                      onClick={() => onDeleteComment(item.id)}
                      className="shrink-0 text-[var(--muted-2)] opacity-0 transition-opacity hover:text-[var(--danger)] group-hover/comment:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--muted-2)]">
                    {formatSavedDate(item.createdAt)}
                  </div>
                </div>
              ))}

              <div className="flex items-end gap-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      submitComment();
                    }
                  }}
                  rows={2}
                  className={areaClass.replace("min-h-[88px]", "min-h-[44px]")}
                  placeholder="Add a comment…"
                />
                <button
                  type="button"
                  aria-label="Add comment"
                  title="Add comment"
                  onClick={submitComment}
                  disabled={!comment.trim()}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--text)] text-white disabled:bg-transparent disabled:text-[var(--muted-2)]"
                >
                  <Send size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
        {label}
      </span>
      {children}
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
