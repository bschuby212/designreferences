"use client";

import type { LinkPreview } from "@/lib/preview/types";
import { getDb, repository } from "@/lib/storage";
import { EXAMPLE_SEEDS } from "@/lib/storage/seed-examples";
import type { Reference } from "@/lib/storage/types";
import { base64ToBlob } from "@/lib/utils";

const CONCURRENCY = 4;

async function preview(url: string, imageUrl?: string): Promise<LinkPreview | null> {
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, imageUrl }),
    });
    if (!res.ok) return null;
    return (await res.json()) as LinkPreview;
  } catch {
    return null;
  }
}

export async function seedExampleReferences() {
  await repository.seedIfEmpty();
  const collections = await getDb().collections.toArray();
  const byName = new Map(collections.map((c) => [c.name, c.id]));
  const existing = await getDb().references.toArray();
  const seen = new Set(
    existing.map((item) => `${item.collectionId ?? ""}:${item.url}`),
  );
  const seenUrls = new Set(existing.map((item) => item.url));
  const seenImages = new Set(
    existing.map((item) => item.thumbnailUrl).filter(Boolean) as string[],
  );

  // Skip anything already stored, plus repeated URLs/images within the seed set
  // itself so the same screen never shows up twice.
  const pending = EXAMPLE_SEEDS.filter((item) => {
    const collectionId = byName.get(item.collection);
    if (!collectionId) return false;
    if (seen.has(`${collectionId}:${item.url}`)) return false;
    if (seenUrls.has(item.url) || seenImages.has(item.imageUrl)) return false;
    seenUrls.add(item.url);
    seenImages.add(item.imageUrl);
    return true;
  });

  // Save the product image URL first so tiles render immediately.
  const created: Reference[] = [];
  for (const item of pending) {
    const collectionId = byName.get(item.collection);
    if (!collectionId) continue;
    created.push(
      await repository.createReference({
        title: item.title,
        url: item.url,
        thumbnail: null,
        thumbnailUrl: item.imageUrl,
        thumbnailType: "og",
        imageUrls: [item.imageUrl],
        source: "Mobbin",
        collectionId,
        tags: item.tags,
        notes: "",
      }),
    );
  }

  let index = 0;
  async function worker() {
    while (index < created.length) {
      const currentIndex = index++;
      const current = created[currentIndex];
      const seed = pending[currentIndex];
      const data = await preview(current.url, seed?.imageUrl);
      if (!data) continue;
      const thumbnail = data.thumbnail
        ? base64ToBlob(data.thumbnail.data, data.thumbnail.mime)
        : null;
      const imageUrls =
        data.images.length > 0
          ? data.images
          : seed?.imageUrl
            ? [seed.imageUrl]
            : current.imageUrls;
      await repository.updateReference(current.id, {
        title: data.title || current.title,
        url: data.url || current.url,
        thumbnail,
        thumbnailUrl: data.thumbnailUrl || seed?.imageUrl || current.thumbnailUrl,
        thumbnailType: thumbnail
          ? data.thumbnailType
          : data.thumbnailUrl || seed?.imageUrl
            ? "og"
            : current.thumbnailType,
        imageUrls,
        source: data.source ?? "Mobbin",
      });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}
