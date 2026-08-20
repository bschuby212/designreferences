"use client";

import { repository } from "@/lib/storage";
import { EXAMPLE_SEEDS, SEED_REVISION } from "@/lib/storage/seed-examples";

const REVISION_KEY = "seedRevision";

/**
 * Installs the seeded example references.
 *
 * Categories and screen sets change when the seed data is rebuilt, and the old
 * behaviour of "insert anything whose URL is missing" left stale rows behind
 * forever. Instead the stored revision is compared with the current one: on a
 * mismatch every seeded reference is removed and rewritten, while references
 * the user created (no seedKey) are left alone.
 */
export async function seedExampleReferences() {
  await repository.seedIfEmpty();

  const storedRevision = await repository.getMeta(REVISION_KEY);
  const references = await repository.listReferences();
  const seeded = references.filter((reference) => reference.seedKey);
  const upToDate =
    storedRevision === SEED_REVISION && seeded.length === EXAMPLE_SEEDS.length;
  if (upToDate) return;

  const names = [...new Set(EXAMPLE_SEEDS.flatMap((seed) => seed.collections))];
  const collections = await repository.ensureCollections(names);
  const idByName = new Map(
    collections.map((collection) => [collection.name.toLowerCase(), collection.id]),
  );

  await repository.deleteSeededReferences();

  // Oldest first so the newest seed still lands at the top of the gallery.
  for (const seed of [...EXAMPLE_SEEDS].reverse()) {
    const collectionIds = seed.collections
      .map((name) => idByName.get(name.toLowerCase()))
      .filter((id): id is string => Boolean(id));
    await repository.createReference({
      title: seed.title,
      url: seed.url,
      thumbnail: null,
      thumbnailUrl: seed.screens[0]?.src ?? null,
      thumbnailType: "og",
      source: seed.source,
      collectionIds,
      screens: seed.screens.map((screen) => ({ ...screen })),
      aspect: seed.aspect,
      seedKey: seed.key,
      tags: seed.tags,
      notes: seed.notes,
    });
  }

  await repository.setMeta(REVISION_KEY, SEED_REVISION);
}
