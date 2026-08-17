"use client";

import type { LinkPreview } from "@/lib/preview/types";
import { getDb, repository } from "@/lib/storage";
import { EXAMPLE_SEEDS } from "@/lib/storage/seed-examples";
import type { Reference } from "@/lib/storage/types";
import { base64ToBlob } from "@/lib/utils";

const CONCURRENCY = 4;

// React runs effects twice in dev (Strict Mode), which previously let two
// seeding passes race and duplicate the entire library. A module-level lock
// ensures only one pass runs at a time.
let seedRunLock: Promise<void> | null = null;

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
  if (seedRunLock) return seedRunLock;
  seedRunLock = runSeed().finally(() => {
    seedRunLock = null;
  });
  return seedRunLock;
}

async function runSeed() {
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

  // Upgrade flows that were seeded before multi-image support existed: fetch the
  // full set of screens so they render as a carousel. Idempotent — once a flow
  // has more than one image stored, it is skipped on future loads.
  const upgradeFlows = existing.filter(
    (item) => /\/flows\//.test(item.url) && (item.imageUrls?.length ?? 0) < 2,
  );
  let upgradeIndex = 0;
  async function upgradeWorker() {
    while (upgradeIndex < upgradeFlows.length) {
      const item = upgradeFlows[upgradeIndex++];
      const data = await preview(item.url, item.thumbnailUrl ?? undefined);
      if (!data || data.images.length < 2) continue;
      const thumbnail = data.thumbnail
        ? base64ToBlob(data.thumbnail.data, data.thumbnail.mime)
        : null;
      await repository.updateReference(item.id, {
        imageUrls: data.images,
        thumbnailUrl: data.thumbnailUrl || item.thumbnailUrl,
        ...(thumbnail
          ? { thumbnail, thumbnailType: data.thumbnailType }
          : {}),
      });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => upgradeWorker()));
}
