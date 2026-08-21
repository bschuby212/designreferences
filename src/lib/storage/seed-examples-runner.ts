"use client";

import { exclusiveCollectionNames } from "@/lib/classify/category";
import { repository } from "@/lib/storage";
import { EXAMPLE_SEEDS, SEED_REVISION } from "@/lib/storage/seed-examples";
import type { CreateReferenceInput } from "@/lib/storage/types";

const REVISION_KEY = "seedRevision";

// React invokes effects twice in development, and two installs racing each
// other produced a doubled library and duplicate collections. Callers share a
// single run.
let install: Promise<void> | null = null;

/**
 * Installs the seeded example references.
 *
 * Categories and screen sets change when the seed data is rebuilt, and the old
 * behaviour of "insert anything whose URL is missing" left stale rows behind
 * forever. Instead the stored revision is compared with the current one: on a
 * mismatch every seeded reference is replaced, while references the user
 * created (no seedKey) are left alone.
 */
export function seedExampleReferences() {
  if (!install) {
    install = run().finally(() => {
      install = null;
    });
  }
  return install;
}

async function run() {
  await repository.seedIfEmpty();
  await repository.mergeDuplicateCollections();
  await repository.syncCanonicalCollections();

  const storedRevision = await repository.getMeta(REVISION_KEY);
  const seededCount = await repository.countSeededReferences();
  if (storedRevision === SEED_REVISION && seededCount === EXAMPLE_SEEDS.length) {
    return;
  }

  const names = [...new Set(EXAMPLE_SEEDS.flatMap((seed) => seed.collections))];
  const collections = await repository.ensureCollections(names);
  const idByName = new Map(
    collections.map((collection) => [collection.name.trim().toLowerCase(), collection.id]),
  );

  // Reversed so the first authored seed ends up newest in the gallery.
  const inputs: CreateReferenceInput[] = [...EXAMPLE_SEEDS].reverse().map((seed) => ({
    title: seed.title,
    url: seed.url,
    thumbnail: null,
    thumbnailUrl: seed.screens[0]?.src ?? null,
    thumbnailType: "og",
    source: seed.source,
    collectionIds: exclusiveCollectionNames(seed.collections)
      .map((name) => idByName.get(name.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id)),
    screens: seed.screens.map((screen) => ({ ...screen })),
    aspect: seed.aspect,
    seedKey: seed.key,
    tags: seed.tags,
    notes: seed.notes,
  }));

  await repository.replaceSeededReferences(inputs);
  await repository.setMeta(REVISION_KEY, SEED_REVISION);
}
