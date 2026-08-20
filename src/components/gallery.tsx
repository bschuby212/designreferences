"use client";

import type { Reference } from "@/lib/storage/types";
import { ReferenceCard } from "./reference-card";

interface GalleryProps {
  references: Reference[];
  selectedId: string | null;
  collectionNames: Record<string, string>;
  emptyTitle: string;
  emptyHint: string;
  onOpen: (id: string) => void;
  onFavorite: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSelectCollection: (id: string) => void;
  onFiles: (files: File[]) => void;
}

export function Gallery({
  references,
  selectedId,
  collectionNames,
  emptyTitle,
  emptyHint,
  onOpen,
  onFavorite,
  onEdit,
  onDelete,
  onSelectCollection,
  onFiles,
}: GalleryProps) {
  const ordered = [...references].sort((a, b) => {
    const aMulti = a.screens.length > 1 ? 1 : 0;
    const bMulti = b.screens.length > 1 ? 1 : 0;
    return bMulti - aMulti;
  });

  return (
    <div
      className="h-full overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-10 md:px-12"
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
        <div className="gallery-flex">
          {ordered.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              collectionNames={reference.collectionIds
                .map((id) => collectionNames[id])
                .filter((name): name is string => Boolean(name))}
              selected={reference.id === selectedId}
              onOpen={() => onOpen(reference.id)}
              onFavorite={() => onFavorite(reference.id)}
              onEdit={() => onEdit(reference.id)}
              onDelete={() => onDelete(reference.id)}
              onSelectCollection={onSelectCollection}
            />
          ))}
        </div>
      )}
    </div>
  );
}
