"use client";

import type { Density, Reference } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { ReferenceCard } from "./reference-card";

interface GalleryProps {
  references: Reference[];
  density: Density;
  collectionNames: Record<string, string>;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onFiles: (files: File[]) => void;
  onSelectCollection: (id: string) => void;
  onSelectTag: (tag: string) => void;
  onSelectSource: (source: Reference["source"]) => void;
}

export function Gallery({
  references,
  density,
  collectionNames,
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
  onFiles,
  onSelectCollection,
  onSelectTag,
  onSelectSource,
}: GalleryProps) {
  return (
    <div
      className={cn(
        "h-full overflow-y-auto overscroll-contain px-4 pb-10 md:px-6 lg:px-8",
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
              collectionName={
                reference.collectionId
                  ? collectionNames[reference.collectionId]
                  : undefined
              }
              onOpen={() => onOpen(reference.id)}
              onFavorite={() => onFavorite(reference.id)}
              onEdit={() => onEdit(reference.id)}
              onDelete={() => onDelete(reference.id)}
              onSelectCollection={onSelectCollection}
              onSelectTag={onSelectTag}
              onSelectSource={onSelectSource}
            />
          ))}
        </div>
      )}
    </div>
  );
}
