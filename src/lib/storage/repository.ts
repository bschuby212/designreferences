import {
  classifyReference,
  isNavigationContent,
  isOnboardingContent,
  isSignupContent,
  resolveAllowedCollectionName,
} from "../classify/category";
import { now, normalizeUrl, uid } from "../utils";
import { getDb } from "./indexeddb";
import {
  CANONICAL_NAV_COLLECTIONS,
  DEFAULT_COLLECTIONS,
  OBSOLETE_NAV_COLLECTIONS,
  type Collection,
  type CreateReferenceInput,
  type Reference,
  type ReferenceRecord,
  type ReferenceScreen,
} from "./types";

function mergeScreens(a: ReferenceScreen[], b: ReferenceScreen[]) {
  const seen = new Set(a.map((screen) => screen.src));
  return [...a, ...b.filter((screen) => !seen.has(screen.src))];
}

function toReference(
  record: ReferenceRecord,
  blob: Blob | null,
): Reference {
  return {
    ...record,
    thumbnailUrl: record.thumbnailUrl ?? null,
    collectionIds: record.collectionIds ?? [],
    screens: record.screens ?? [],
    aspect: record.aspect ?? null,
    seedKey: record.seedKey ?? null,
    thumbnail: blob,
  };
}

export interface LibraryRepository {
  listReferences(): Promise<Reference[]>;
  getReference(id: string): Promise<Reference | undefined>;
  createReference(input: CreateReferenceInput): Promise<Reference>;
  updateReference(
    id: string,
    patch: Partial<
      Omit<Reference, "id" | "createdAt" | "thumbnail"> & { thumbnail: Blob | null }
    >,
  ): Promise<Reference | undefined>;
  deleteReference(id: string): Promise<void>;
  listCollections(): Promise<Collection[]>;
  createCollection(name: string): Promise<Collection>;
  renameCollection(id: string, name: string): Promise<void>;
  deleteCollection(id: string): Promise<void>;
  seedIfEmpty(): Promise<void>;
  ensureCollections(names: string[]): Promise<Collection[]>;
  syncCanonicalCollections(): Promise<void>;
  mergeDuplicateCollections(): Promise<number>;
  replaceSeededReferences(inputs: CreateReferenceInput[]): Promise<number>;
  countSeededReferences(): Promise<number>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

let seedLock: Promise<void> | null = null;

export const indexedDbRepository: LibraryRepository = {
  async listReferences() {
    const records = await getDb().references.orderBy("createdAt").reverse().toArray();
    const thumbs = await getDb().thumbnails.toArray();
    const byId = new Map(thumbs.map((t) => [t.id, t.blob]));
    return records.map((record) => toReference(record, byId.get(record.id) ?? null));
  },

  async getReference(id) {
    const record = await getDb().references.get(id);
    if (!record) return undefined;
    const thumb = await getDb().thumbnails.get(id);
    return toReference(record, thumb?.blob ?? null);
  },

  async createReference(input) {
    const timestamp = now();
    const record: ReferenceRecord = {
      id: uid(),
      title: input.title,
      url: input.url,
      thumbnailUrl: input.thumbnailUrl ?? null,
      thumbnailType: input.thumbnailType,
      source: input.source,
      collectionIds: input.collectionIds ?? [],
      screens: input.screens ?? [],
      aspect: input.aspect ?? null,
      seedKey: input.seedKey ?? null,
      tags: input.tags,
      notes: input.notes,
      favorite: input.favorite ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await getDb().transaction("rw", getDb().references, getDb().thumbnails, async () => {
      await getDb().references.put(record);
      if (input.thumbnail) {
        await getDb().thumbnails.put({ id: record.id, blob: input.thumbnail });
      }
    });
    return toReference(record, input.thumbnail);
  },

  async updateReference(id, patch) {
    const existing = await getDb().references.get(id);
    if (!existing) return undefined;
    const { thumbnail, ...rest } = patch;
    const next: ReferenceRecord = {
      ...existing,
      ...rest,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
    };
    await getDb().transaction("rw", getDb().references, getDb().thumbnails, async () => {
      await getDb().references.put(next);
      if (thumbnail !== undefined) {
        if (thumbnail) await getDb().thumbnails.put({ id, blob: thumbnail });
        else await getDb().thumbnails.delete(id);
      }
    });
    const thumb = await getDb().thumbnails.get(id);
    return toReference(next, thumb?.blob ?? null);
  },

  async deleteReference(id) {
    await getDb().transaction("rw", getDb().references, getDb().thumbnails, async () => {
      await getDb().references.delete(id);
      await getDb().thumbnails.delete(id);
    });
  },

  async listCollections() {
    return getDb().collections.orderBy("sortOrder").toArray();
  },

  async createCollection(name) {
    const resolved = resolveAllowedCollectionName(name);
    if (!resolved) {
      const existingUnknown = await getDb().collections.toArray();
      const match = existingUnknown.find(
        (row) => row.name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (match) return match;
      throw new Error("Unknown category");
    }
    const collections = await getDb().collections.toArray();
    const existing = collections.find(
      (row) => row.name.trim().toLowerCase() === resolved.toLowerCase(),
    );
    if (existing) return existing;
    const collection: Collection = {
      id: uid(),
      name: resolved,
      createdAt: now(),
      sortOrder: collections.length,
    };
    await getDb().collections.put(collection);
    return collection;
  },

  async renameCollection(id, name) {
    await getDb().collections.update(id, { name: name.trim() });
  },

  async deleteCollection(id) {
    await getDb().transaction("rw", getDb().collections, getDb().references, async () => {
      await getDb().collections.delete(id);
      const affected = await getDb()
        .references.where("collectionIds")
        .equals(id)
        .toArray();
      for (const record of affected) {
        await getDb().references.update(record.id, {
          collectionIds: (record.collectionIds ?? []).filter((c) => c !== id),
          updatedAt: now(),
        });
      }
    });
  },

  async seedIfEmpty() {
    if (!seedLock) {
      seedLock = (async () => {
        const count = await getDb().collections.count();
        if (count > 0) return;
        const timestamp = now();
        await getDb().collections.bulkPut(
          DEFAULT_COLLECTIONS.map((name, index) => ({
            id: uid(),
            name,
            createdAt: timestamp,
            sortOrder: index,
          })),
        );
      })().finally(() => {
        seedLock = null;
      });
    }
    return seedLock;
  },

  /**
   * Collections the seeded examples need. Missing ones are appended rather
   * than recreated, so a renamed or deleted collection is not resurrected on
   * top of the user's own ordering.
   */
  async ensureCollections(names) {
    const allowed = new Set(DEFAULT_COLLECTIONS.map((name) => name.toLowerCase()));
    const obsolete = new Set(
      OBSOLETE_NAV_COLLECTIONS.map((name) => name.toLowerCase()),
    );
    const existing = await getDb().collections.toArray();
    const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
    let sortOrder = existing.length;
    for (const name of names) {
      const resolved = resolveAllowedCollectionName(name) ?? name.trim();
      if (obsolete.has(resolved.toLowerCase())) continue;
      if (!allowed.has(resolved.toLowerCase())) continue;
      if (byName.has(resolved.toLowerCase())) continue;
      const collection: Collection = {
        id: uid(),
        name: resolved,
        createdAt: now(),
        sortOrder: sortOrder++,
      };
      await getDb().collections.put(collection);
      byName.set(resolved.toLowerCase(), collection);
    }
    return getDb().collections.orderBy("sortOrder").toArray();
  },

  /**
   * Renames and merges the old chip set onto the six canonical canvases.
   * User-created collections keep their ids; only empty obsolete chips are
   * deleted after references have been remapped.
   */
  async syncCanonicalCollections() {
    const db = getDb();
    await db.transaction("rw", db.collections, db.references, db.thumbnails, db.meta, async () => {
      const byName = async () => {
        const rows = await db.collections.toArray();
        return new Map(rows.map((row) => [row.name.trim().toLowerCase(), row]));
      };

      const ensureNamed = async (name: string) => {
        const map = await byName();
        const existing = map.get(name.toLowerCase());
        if (existing) return existing;
        const rows = await db.collections.toArray();
        const collection: Collection = {
          id: uid(),
          name,
          createdAt: now(),
          sortOrder: rows.length,
        };
        await db.collections.put(collection);
        return collection;
      };

      const labelsOf = (record: ReferenceRecord) =>
        (record.screens ?? []).map((screen) => screen.label);

      const destForObsolete = (
        sourceName: string,
        record: ReferenceRecord,
      ): string | null => {
        const lower = sourceName.trim().toLowerCase();
        if (lower === "onboarding") return "Mobile Onboarding";
        if (lower === "navigation") return "Mobile Navigation";
        if (lower === "mobile" || lower === "mobile app") {
          if (isOnboardingContent(record.title, record.notes, labelsOf(record))) {
            return "Mobile Onboarding";
          }
          if (isNavigationContent(record.title, record.notes, labelsOf(record))) {
            return "Mobile Navigation";
          }
          return "Mobile Apps";
        }
        if (
          lower === "website" ||
          lower === "websites" ||
          lower === "web" ||
          lower === "landing page" ||
          lower === "landing pages" ||
          lower === "marketing"
        ) {
          if (isSignupContent(record.title, record.notes, labelsOf(record))) {
            return "Web Sign-Up";
          }
          return "Web & Landing Pages";
        }
        if (lower === "product design") return "Dashboards";
        if (lower === "components") {
          const names = classifyReference({
            title: record.title,
            url: record.url,
            notes: record.notes,
            screenLabels: labelsOf(record),
            originalCategory: "Components",
          });
          return (
            names.find((name) =>
              (CANONICAL_NAV_COLLECTIONS as readonly string[]).includes(name),
            ) ?? null
          );
        }
        return resolveAllowedCollectionName(sourceName);
      };

      for (const name of DEFAULT_COLLECTIONS) await ensureNamed(name);

      const obsoleteNames = new Set(
        OBSOLETE_NAV_COLLECTIONS.map((name) => name.toLowerCase()),
      );
      const obsoleteRows = (await db.collections.toArray()).filter((row) =>
        obsoleteNames.has(row.name.trim().toLowerCase()),
      );
      const stats = { mobileToApps: 0, websiteToLanding: 0, componentsMoved: 0, componentsHidden: 0 };

      for (const source of obsoleteRows) {
        const destCache = new Map<string | null, string | null>();
        const references = await db.references.toArray();
        for (const record of references) {
          const ids = record.collectionIds ?? [];
          if (!ids.includes(source.id)) continue;
          const destName = destForObsolete(source.name, record);
          if (!destCache.has(destName)) {
            destCache.set(
              destName,
              destName ? (await ensureNamed(destName)).id : null,
            );
          }
          const destId = destCache.get(destName) ?? null;
          const next = ids.filter((id) => id !== source.id);
          if (destId && !next.includes(destId)) next.push(destId);
          await db.references.update(record.id, { collectionIds: next });

          const lower = source.name.trim().toLowerCase();
          if ((lower === "mobile" || lower === "mobile app") && destName === "Mobile Apps") {
            stats.mobileToApps += 1;
          }
          if (
            (lower === "website" || lower === "websites" || lower === "web") &&
            destName === "Web & Landing Pages"
          ) {
            stats.websiteToLanding += 1;
          }
          if (lower === "components") {
            if (destName) stats.componentsMoved += 1;
            else stats.componentsHidden += 1;
          }
        }
        await db.collections.delete(source.id);
      }

      const grouped = new Map<string, ReferenceRecord[]>();
      for (const record of await db.references.toArray()) {
        const key = normalizeUrl(record.url);
        if (!key) continue;
        const list = grouped.get(key) ?? [];
        list.push(record);
        grouped.set(key, list);
      }
      for (const group of grouped.values()) {
        if (group.length < 2) continue;
        group.sort((a, b) => {
          const seeded = Number(Boolean(b.seedKey)) - Number(Boolean(a.seedKey));
          if (seeded) return seeded;
          return a.createdAt - b.createdAt;
        });
        const survivor = group[0];
        let screens = survivor.screens ?? [];
        let collectionIds = [...(survivor.collectionIds ?? [])];
        for (const extra of group.slice(1)) {
          const overlap = (extra.collectionIds ?? []).some((id) =>
            collectionIds.includes(id),
          );
          if (!overlap) continue;
          screens = mergeScreens(screens, extra.screens ?? []);
          collectionIds = [...new Set([...collectionIds, ...(extra.collectionIds ?? [])])];
          await db.references.delete(extra.id);
          await db.thumbnails.delete(extra.id);
        }
        await db.references.update(survivor.id, { screens, collectionIds });
      }

      const used = new Set(
        (await db.references.toArray()).flatMap((row) => row.collectionIds ?? []),
      );
      const obsolete = new Set(
        OBSOLETE_NAV_COLLECTIONS.map((name) => name.toLowerCase()),
      );
      for (const row of await db.collections.toArray()) {
        if ((DEFAULT_COLLECTIONS as readonly string[]).includes(row.name)) continue;
        const leftover = obsolete.has(row.name.trim().toLowerCase());
        if (leftover || !used.has(row.id)) await db.collections.delete(row.id);
      }

      const current = await byName();
      let sortOrder = 0;
      for (const name of DEFAULT_COLLECTIONS) {
        const row = current.get(name.toLowerCase());
        if (!row) continue;
        await db.collections.update(row.id, { sortOrder: sortOrder++ });
      }

      await db.meta.put({
        key: "category-allowlist-stats",
        value: JSON.stringify(stats),
      });
    });
  },

  /**
   * Collapses collections that share a name. Seeding used to be able to run
   * twice concurrently, which left two rows called e.g. "Motion": the sidebar
   * showed one of them with a count of zero while the references pointed at
   * the other. Duplicates are merged into the earliest row and references are
   * remapped, so an affected library repairs itself on load.
   */
  async mergeDuplicateCollections() {
    let merged = 0;
    await getDb().transaction("rw", getDb().collections, getDb().references, async () => {
      const collections = await getDb().collections.orderBy("sortOrder").toArray();
      const keep = new Map<string, string>();
      const remap = new Map<string, string>();
      for (const collection of collections) {
        const name = collection.name.trim().toLowerCase();
        const existing = keep.get(name);
        if (existing) {
          remap.set(collection.id, existing);
        } else {
          keep.set(name, collection.id);
        }
      }
      if (remap.size === 0) return;
      merged = remap.size;
      for (const id of remap.keys()) await getDb().collections.delete(id);
      const references = await getDb().references.toArray();
      for (const record of references) {
        const ids = record.collectionIds ?? [];
        const next = [...new Set(ids.map((id) => remap.get(id) ?? id))];
        if (next.length === ids.length && next.every((id, i) => id === ids[i])) {
          continue;
        }
        await getDb().references.update(record.id, { collectionIds: next });
      }
    });
    return merged;
  },

  /**
   * Swaps the seeded examples in a single transaction. References a user added
   * have no seedKey and are left untouched; doing it atomically means a reload
   * mid-install cannot leave the library half seeded or duplicated.
   */
  async replaceSeededReferences(inputs) {
    const timestamp = now();
    return getDb().transaction(
      "rw",
      getDb().references,
      getDb().thumbnails,
      async () => {
        const seeded = await getDb()
          .references.filter((record) => Boolean(record.seedKey))
          .toArray();
        for (const record of seeded) {
          await getDb().references.delete(record.id);
          await getDb().thumbnails.delete(record.id);
        }
        const records: ReferenceRecord[] = inputs.map((input, index) => ({
          id: uid(),
          title: input.title,
          url: input.url,
          thumbnailUrl: input.thumbnailUrl ?? null,
          thumbnailType: input.thumbnailType,
          source: input.source,
          collectionIds: input.collectionIds ?? [],
          screens: input.screens ?? [],
          aspect: input.aspect ?? null,
          seedKey: input.seedKey ?? null,
          tags: input.tags,
          notes: input.notes,
          favorite: input.favorite ?? false,
          // Keep the authored order stable in a "newest first" gallery.
          createdAt: timestamp + index,
          updatedAt: timestamp + index,
        }));
        await getDb().references.bulkPut(records);
        return records.length;
      },
    );
  },

  async countSeededReferences() {
    return getDb().references.filter((record) => Boolean(record.seedKey)).count();
  },

  async getMeta(key) {
    const record = await getDb().meta.get(key);
    return record?.value ?? null;
  },

  async setMeta(key, value) {
    await getDb().meta.put({ key, value });
  },
};
