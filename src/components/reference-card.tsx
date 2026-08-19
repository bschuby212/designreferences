"use client";

import type { Reference } from "@/lib/storage/types";
import { cleanDesignTitle } from "@/lib/storage/product-tags";
import { heroShotUrl, isPhoneFrame } from "@/lib/utils";
import { CollectionChip, CompanyHeading } from "./category-icons";
import { referenceImageUrls, useObjectUrl, useThumbnailSrc } from "./hooks";
import { ThumbnailCarousel } from "./thumbnail-carousel";

interface ReferenceCardProps {
  reference: Reference;
  collectionName?: string;
  onOpen: () => void;
  onSelectCollection?: (id: string) => void;
}

export function ReferenceCard({
  reference,
  collectionName,
  onOpen,
  onSelectCollection,
}: ReferenceCardProps) {
  const src = useThumbnailSrc(reference);
  const blobSrc = useObjectUrl(reference.thumbnail);
  const images = referenceImageUrls(reference).map(heroShotUrl);
  const phone = isPhoneFrame(collectionName, reference.url, src);
  const slides =
    images.length > 0
      ? phone
        ? images.map((url, i) =>
            (blobSrc || src) && (url === heroShotUrl(reference.thumbnailUrl || "") || i === 0)
              ? (blobSrc || src)!
              : url,
          )
        : images
      : src
        ? [src]
        : [];

  return (
    <article className="relative mb-0 flex h-full min-w-0 break-inside-avoid flex-col">
      <ThumbnailCarousel
        images={slides}
        alt={cleanDesignTitle(reference.title) || "Reference"}
        pageUrl={reference.url}
        onOpen={onOpen}
        cropTop={!phone}
        frame={phone ? "phone" : "wide"}
        videoUrl={reference.videoUrl}
        autoPlay={collectionName === "Motion"}
      />

      <div className="mt-3 flex min-w-0 items-center gap-2 overflow-hidden px-0.5">
        <CompanyHeading
          name={cleanDesignTitle(reference.title) || "Untitled"}
          onClick={onOpen}
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
    </article>
  );
}
