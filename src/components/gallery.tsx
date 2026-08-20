"use client";

import type { Density, Reference } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { ReferenceCard } from "./reference-card";

interface GalleryProps {
  references: Reference[];
  density: Density;
  compactMeta: boolean;
  emptyTitle: string;
  emptyHint: string;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onFiles: (files: File[]) => void;
}

export function Gallery({
  references,
  density,
  compactMeta,
  emptyTitle,
  emptyHint,
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
  onFiles,
}: GalleryProps) {
  return (
    <div
      className={cn(
        "h-full overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-8 md:px-4",
        `density-${density}`,
      )}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const files = [...e.dataTransfer.files].filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length) onFiles(files);
      }}
    >
      {references.length === 0 ? (
        <div className="mx-auto max-w-[320px] px-4 py-16 text-center">
          <p className="text-[14px] font-medium tracking-tight">{emptyTitle}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
            {emptyHint}
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {references.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              compactMeta={compactMeta}
              onOpen={() => onOpen(reference.id)}
              onFavorite={() => onFavorite(reference.id)}
              onEdit={() => onEdit(reference.id)}
              onDelete={() => onDelete(reference.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
