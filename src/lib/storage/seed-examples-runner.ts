"use client";

import type { LinkPreview } from "@/lib/preview/types";
import { getDb, repository } from "@/lib/storage";
import flowFrames from "@/lib/storage/flow-frames.json";
import { motionPreviewFor } from "@/lib/storage/motion-assets";
import { collectionForSeed } from "@/lib/storage/collection-rules";
import { EXAMPLE_SEEDS } from "@/lib/storage/seed-examples";
import { cleanDesignTitle, productTagsFor } from "@/lib/storage/product-tags";
import { DEFAULT_COLLECTIONS, type SourceType } from "@/lib/storage/types";
import type { Reference } from "@/lib/storage/types";
import {
  base64ToBlob,
  heroShotUrl,
  imageAssetKey,
  isEncryptedCdn,
  isMobbinFlow,
  isMotionSrc,
  now,
  uid,
} from "@/lib/utils";

const CONCURRENCY = 4;
export const SEED_VERSION = 11;
const SEED_VERSION_KEY = "library-seed-version";

const COLLECTION_RENAMES: Record<string, string> = {
  Dashboards: "Product Design",
  Web: "Website",
  Marketing: "Website",
  Branding: "Website",
  Typography: "Website",
};

const RETIRED_COLLECTION_NAMES = new Set([
  "Dashboards",
  "Web",
  "Marketing",
  "Branding",
  "Typography",
]);

const FLOW_FRAMES = flowFrames as Record<string, string[]>;

let seedRunLock: Promise<void> | null = null;

async function preview(
  url: string,
  imageUrl?: string,
  metaOnly = false,
): Promise<LinkPreview | null> {
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, imageUrl, metaOnly }),
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

async function ensureCollection(
  name: string,
  sortOrder: number,
  byName: Map<string, string>,
) {
  const existing = byName.get(name);
  if (existing) return existing;
  const timestamp = now();
  const collection = {
    id: uid(),
    name,
    createdAt: timestamp,
    sortOrder,
  };
  await getDb().collections.put(collection);
  byName.set(name, collection.id);
  return collection.id;
}

function uniqueUrls(urls: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url) continue;
    const key = imageAssetKey(url) || url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

function framesFor(url: string, fallback?: string | null) {
  const extras = FLOW_FRAMES[url] ?? [];
  return uniqueUrls([fallback, ...extras]);
}

async function migrateCollections() {
  const collections = await getDb().collections.toArray();
  const byName = new Map(collections.map((c) => [c.name, c.id]));

  for (const [from, to] of Object.entries(COLLECTION_RENAMES)) {
    const fromId = byName.get(from);
    if (!fromId) continue;
    const toId = byName.get(to);
    if (toId && toId !== fromId) {
      await getDb().references.where("collectionId").equals(fromId).modify({
        collectionId: toId,
        updatedAt: now(),
      });
      await getDb().collections.delete(fromId);
      byName.delete(from);
    } else {
      await repository.renameCollection(fromId, to);
      byName.delete(from);
      byName.set(to, fromId);
    }
  }

  for (const [index, name] of DEFAULT_COLLECTIONS.entries()) {
    await ensureCollection(name, index, byName);
  }

  const leftover = await getDb().collections.toArray();
  for (const collection of leftover) {
    if (!RETIRED_COLLECTION_NAMES.has(collection.name)) continue;
    const websiteId = byName.get("Website");
    if (websiteId && websiteId !== collection.id) {
      await getDb().references.where("collectionId").equals(collection.id).modify({
        collectionId: websiteId,
        updatedAt: now(),
      });
    }
    await getDb().collections.delete(collection.id);
    byName.delete(collection.name);
  }

  const ordered = await getDb().collections.toArray();
  for (const collection of ordered) {
    const sortOrder = DEFAULT_COLLECTIONS.indexOf(collection.name);
    if (sortOrder >= 0 && collection.sortOrder !== sortOrder) {
      await getDb().collections.update(collection.id, { sortOrder });
    }
  }
}

async function remapSeedCollections(byName: Map<string, string>) {
  const seedByUrl = new Map(EXAMPLE_SEEDS.map((item) => [item.url, item]));
  const refs = await getDb().references.toArray();
  for (const record of refs) {
    const seed = seedByUrl.get(record.url);
    if (!seed) continue;
    const nextName = collectionForSeed(seed) ?? seed.collection;
    const targetId = byName.get(nextName);
    if (!targetId || record.collectionId === targetId) continue;
    await repository.updateReference(record.id, {
      collectionId: targetId,
      tags: productTagsFor(nextName, cleanDesignTitle(record.title)),
    });
  }
}

async function remapPlayableMotion(byName: Map<string, string>) {
  const motionId = byName.get("Motion");
  if (!motionId) return;
  const refs = await getDb().references.toArray();
  for (const record of refs) {
    const hasMotion = [record.videoUrl, record.thumbnailUrl, ...(record.imageUrls ?? [])].some(
      (url) => isMotionSrc(url),
    );
    if (!hasMotion || record.collectionId === motionId) continue;
    await repository.updateReference(record.id, {
      collectionId: motionId,
      tags: productTagsFor("Motion", cleanDesignTitle(record.title)),
    });
  }
}

async function refreshStaleSeeds() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION));
}

async function collapseMixedScreens() {
  const seedByUrl = new Map(EXAMPLE_SEEDS.map((item) => [item.url, item]));
  const existing = await getDb().references.toArray();
  for (const record of existing) {
    if (isMobbinFlow(record.url)) continue;
    if (seedByUrl.get(record.url)?.videoUrl) continue;
    if ((record.imageUrls?.length ?? 0) <= 1) continue;
    const one = heroShotUrl(record.thumbnailUrl || record.imageUrls[0]);
    await repository.updateReference(record.id, {
      imageUrls: one ? [one] : [],
    });
  }
}

async function applyCarouselAndHero() {
  const existing = await getDb().references.toArray();
  const seedByUrl = new Map(EXAMPLE_SEEDS.map((item) => [item.url, item]));
  const siblings = new Map<string, string[]>();
  for (const seed of EXAMPLE_SEEDS) {
    if (!/app_screens/.test(seed.imageUrl)) continue;
    const list = siblings.get(seed.title) ?? [];
    list.push(seed.imageUrl);
    siblings.set(seed.title, list);
  }

  for (const record of existing) {
    const seed = seedByUrl.get(record.url);
    const thumb = heroShotUrl(seed?.imageUrl || record.thumbnailUrl || "");
    const flow = framesFor(record.url, thumb || record.thumbnailUrl);
    const related = seed ? siblings.get(seed.title) ?? [] : [];
    const motionStill = false;
    const nextImages = isMobbinFlow(record.url)
      ? uniqueUrls(
          flow.length > 1
            ? flow
            : [thumb || record.thumbnailUrl, ...related, ...(record.imageUrls ?? [])],
        )
      : motionStill
        ? uniqueUrls([thumb || record.thumbnailUrl, ...related])
        : uniqueUrls([thumb || record.thumbnailUrl]);
    const videoUrl =
      seed?.videoUrl ||
      motionPreviewFor(record.url, record.videoUrl) ||
      record.videoUrl ||
      null;
    const patch: {
      thumbnailUrl?: string | null;
      imageUrls?: string[];
      videoUrl?: string | null;
      thumbnail?: Blob | null;
    } = {};
    if (thumb && thumb !== record.thumbnailUrl) patch.thumbnailUrl = thumb;
    if (
      seed?.collection === "Website" ||
      (seed?.collection === "Product Design" && !/app_screens/.test(seed.imageUrl))
    ) {
      patch.thumbnail = null;
    }
    const current = record.imageUrls ?? [];
    const needsFrames =
      nextImages.length > 1 &&
      (current.length < 2 ||
        current.some(isEncryptedCdn) ||
        (isMobbinFlow(record.url) && current.length < nextImages.length));
    if (
      needsFrames ||
      (nextImages[0] &&
        nextImages[0] !== current[0] &&
        !isMobbinFlow(record.url) &&
        !motionStill)
    ) {
      patch.imageUrls = isMobbinFlow(record.url) || motionStill ? nextImages : [nextImages[0]];
    }
    if ((videoUrl || null) !== (record.videoUrl || null)) patch.videoUrl = videoUrl;
    if (Object.keys(patch).length === 0) continue;
    await repository.updateReference(record.id, patch);
  }
}

async function runSeed() {
  await repository.seedIfEmpty();
  await migrateCollections();
  const collections = await getDb().collections.toArray();
  const byName = new Map(collections.map((c) => [c.name, c.id]));
  await remapSeedCollections(byName);
  await remapPlayableMotion(byName);
  await refreshStaleSeeds();
  await collapseMixedScreens();

  const byId = new Map(collections.map((c) => [c.id, c.name]));
  const existing = await getDb().references.toArray();

  for (const record of existing) {
    const collectionName = record.collectionId
      ? (byId.get(record.collectionId) ?? "")
      : "";
    const title = cleanDesignTitle(record.title);
    const tags = productTagsFor(collectionName, title);
    const remapped =
      collectionName === "Web" ||
      collectionName === "Marketing" ||
      collectionName === "Branding" ||
      collectionName === "Typography"
        ? byName.get("Website") ?? record.collectionId
        : collectionName === "Dashboards"
          ? byName.get("Product Design") ?? record.collectionId
          : record.collectionId;
    if (
      title === record.title &&
      tags.join("\0") === record.tags.join("\0") &&
      remapped === record.collectionId
    ) {
      continue;
    }
    await repository.updateReference(record.id, {
      title,
      tags,
      collectionId: remapped,
    });
  }

  await applyCarouselAndHero();

  const after = await getDb().references.toArray();
  const seedByUrl = new Map(EXAMPLE_SEEDS.map((item) => [item.url, item]));
  for (const record of after) {
    const seed = seedByUrl.get(record.url);
    if (!seed?.imageUrl) continue;
    if (isMobbinFlow(record.url)) continue;
    if (seed.collection === "Motion") {
      const nextThumb = heroShotUrl(seed.imageUrl);
      const videoUrl = seed.videoUrl || motionPreviewFor(record.url, record.videoUrl);
      if (
        nextThumb === record.thumbnailUrl &&
        (videoUrl || null) === (record.videoUrl || null)
      ) {
        continue;
      }
      await repository.updateReference(record.id, {
        thumbnailUrl: nextThumb,
        videoUrl,
        notes: seed.notes || record.notes,
        source: (seed.source as SourceType) || record.source,
      });
      continue;
    }
    const nextThumb = heroShotUrl(seed.imageUrl);
    if (nextThumb === record.thumbnailUrl && !seed.videoUrl) continue;
    if (/mobbin\.com/i.test(record.url) && nextThumb === record.thumbnailUrl) continue;
    await repository.updateReference(record.id, {
      thumbnailUrl: nextThumb,
      thumbnailType: "screenshot",
      imageUrls: [nextThumb],
      videoUrl: seed.videoUrl || motionPreviewFor(record.url, record.videoUrl),
      notes: seed.notes || record.notes,
      source: (seed.source as SourceType) || record.source,
    });
  }

  const seen = new Set(
    after.map((item) => `${item.collectionId ?? ""}:${item.url}`),
  );
  const seenUrls = new Set(after.map((item) => item.url));
  const seenImages = new Set(
    after.map((item) => item.thumbnailUrl).filter(Boolean) as string[],
  );

  const pending = EXAMPLE_SEEDS.filter((item) => {
    const name = collectionForSeed(item);
    if (!name) return false;
    const collectionId = byName.get(name);
    if (!collectionId) return false;
    if (seen.has(`${collectionId}:${item.url}`)) return false;
    if (seenUrls.has(item.url) || seenImages.has(item.imageUrl)) return false;
    seenUrls.add(item.url);
    seenImages.add(item.imageUrl);
    return true;
  });

  const created: Reference[] = [];
  for (const item of pending) {
    const name = collectionForSeed(item);
    if (!name) continue;
    const collectionId = byName.get(name);
    if (!collectionId) continue;
    const thumb = heroShotUrl(item.imageUrl);
    created.push(
      await repository.createReference({
        title: cleanDesignTitle(item.title),
        url: item.url,
        thumbnail: null,
        thumbnailUrl: thumb,
        thumbnailType: "og",
        imageUrls: framesFor(item.url, thumb),
        videoUrl: item.videoUrl || motionPreviewFor(item.url),
        source: (item.source as SourceType | undefined) ?? "Mobbin",
        collectionId,
        tags: Array.from(
          new Set([
            ...productTagsFor(name, cleanDesignTitle(item.title)),
            ...item.tags,
          ]),
        ),
        notes: item.notes ?? "",
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
      const keepViewportShot =
        current.source === "Awwwards" || current.source === "Website";
      const seededFrames = framesFor(current.url, seed?.imageUrl);
      const previewFrames = (data.images ?? []).filter((url) => !isEncryptedCdn(url));
      const imageUrls = isMobbinFlow(current.url)
        ? uniqueUrls(
            previewFrames.length > 1
              ? previewFrames
              : seededFrames.length > 1
                ? seededFrames
                : [seed?.imageUrl || current.thumbnailUrl],
          )
        : [
            keepViewportShot
              ? heroShotUrl(
                  seed?.imageUrl ||
                    current.thumbnailUrl ||
                    data.thumbnailUrl ||
                    data.images[0] ||
                    "",
                )
              : heroShotUrl(
                  data.thumbnailUrl ||
                    seed?.imageUrl ||
                    data.images[0] ||
                    current.thumbnailUrl ||
                    "",
                ),
          ].filter(Boolean);
      await repository.updateReference(current.id, {
        title: cleanDesignTitle(data.title || current.title),
        url: data.url || current.url,
        thumbnail: keepViewportShot ? null : thumbnail,
        thumbnailUrl: keepViewportShot
          ? heroShotUrl(seed?.imageUrl || current.thumbnailUrl || "")
          : heroShotUrl(data.thumbnailUrl || seed?.imageUrl || current.thumbnailUrl || ""),
        thumbnailType: keepViewportShot
          ? "screenshot"
          : thumbnail
            ? data.thumbnailType
            : data.thumbnailUrl || seed?.imageUrl
              ? "og"
              : current.thumbnailType,
        imageUrls,
        videoUrl:
          seed?.videoUrl ||
          data.videoUrl ||
          motionPreviewFor(current.url, current.videoUrl),
        source: current.source || data.source,
      });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const latest = await getDb().references.toArray();
  const upgradeFlows = latest.filter((item) => {
    if (!isMobbinFlow(item.url)) return false;
    const urls = item.imageUrls ?? [];
    if (urls.length < 2) return true;
    if (urls.some(isEncryptedCdn)) return true;
    return false;
  });
  let upgradeIndex = 0;
  async function upgradeWorker() {
    while (upgradeIndex < upgradeFlows.length) {
      const item = upgradeFlows[upgradeIndex++];
      const baked = framesFor(item.url, item.thumbnailUrl);
      if (baked.length > 1) {
        await repository.updateReference(item.id, { imageUrls: baked });
        continue;
      }
      const data = await preview(item.url, item.thumbnailUrl ?? undefined);
      const previewFrames = (data?.images ?? []).filter((url) => !isEncryptedCdn(url));
      if (previewFrames.length < 2) continue;
      const thumbnail = data?.thumbnail
        ? base64ToBlob(data.thumbnail.data, data.thumbnail.mime)
        : null;
      await repository.updateReference(item.id, {
        imageUrls: previewFrames,
        thumbnailUrl: data?.thumbnailUrl || item.thumbnailUrl,
        ...(thumbnail && data
          ? { thumbnail, thumbnailType: data.thumbnailType }
          : {}),
      });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => upgradeWorker()));
}
