"use client";

import type { Density, Reference } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { ReferenceCard } from "./reference-card";

interface GalleryProps {
  references: Reference[];
  density: Density;
  collectionNames: Record<string, string>;
  onOpen: (id: string) => void;
  onFiles: (files: File[]) => void;
  onSelectCollection: (id: string) => void;
  mode?: "grid" | "feed";
}

export function Gallery({
  references,
  density,
  collectionNames,
  onOpen,
  onFiles,
  onSelectCollection,
  mode = "grid",
}: GalleryProps) {
  const feed = mode === "feed";
  return (
    <div
      className={cn(
        "h-full overflow-y-auto overscroll-contain px-4 pb-10 md:px-6 lg:px-8",
        !feed && `density-${density}`,
        feed && "snap-y snap-proximity",
      )}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const files = [...e.dataTransfer.files].filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length) onFiles(files);
      }}
    >
      {references.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-[var(--muted-2)]" />
      ) : (
        <div
          className={cn(
            feed
              ? "mx-auto flex max-w-[420px] flex-col gap-8 pt-2 md:max-w-[560px]"
              : "gallery-grid",
          )}
        >
          {references.map((reference) => (
            <div key={reference.id} className={cn(feed && "snap-start")}>
              <ReferenceCard
                reference={reference}
                collectionName={
                  reference.collectionId
                    ? collectionNames[reference.collectionId]
                    : undefined
                }
                onOpen={() => onOpen(reference.id)}
                onSelectCollection={onSelectCollection}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
