"use client";

import type { Density, Reference } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { ReferenceCard } from "./reference-card";

interface GalleryProps {
  references: Reference[];
  density: Density;
  compactMeta: boolean;
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
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
  onFiles,
}: GalleryProps) {
  return (
    <div
      className={cn(
        "h-full overflow-y-auto overscroll-contain px-3 pb-8 md:px-4",
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
        <div className="py-16 text-center text-[13px] text-[var(--muted-2)]" />
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
