import { getDb } from "./indexeddb";
import {
  DEFAULT_COLLECTIONS,
  type Collection,
  type CreateReferenceInput,
  type Reference,
  type ReferenceRecord,
} from "./types";
import { now, uid } from "../utils";

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
    const collections = await getDb().collections.toArray();
    const collection: Collection = {
      id: uid(),
      name: name.trim(),
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
    const existing = await getDb().collections.toArray();
    const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
    const created: Collection[] = [];
    let sortOrder = existing.length;
    for (const name of names) {
      if (byName.has(name.toLowerCase())) continue;
      const collection: Collection = {
        id: uid(),
        name,
        createdAt: now(),
        sortOrder: sortOrder++,
      };
      await getDb().collections.put(collection);
      byName.set(name.toLowerCase(), collection);
      created.push(collection);
    }
    return getDb().collections.orderBy("sortOrder").toArray();
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
