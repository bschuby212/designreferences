import { db } from "./indexeddb";
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
  return { ...record, thumbnail: blob };
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
}

export const indexedDbRepository: LibraryRepository = {
  async listReferences() {
    const records = await db.references.orderBy("createdAt").reverse().toArray();
    const thumbs = await db.thumbnails.toArray();
    const byId = new Map(thumbs.map((t) => [t.id, t.blob]));
    return records.map((record) => toReference(record, byId.get(record.id) ?? null));
  },

  async getReference(id) {
    const record = await db.references.get(id);
    if (!record) return undefined;
    const thumb = await db.thumbnails.get(id);
    return toReference(record, thumb?.blob ?? null);
  },

  async createReference(input) {
    const timestamp = now();
    const record: ReferenceRecord = {
      id: uid(),
      title: input.title,
      url: input.url,
      thumbnailType: input.thumbnailType,
      source: input.source,
      collectionId: input.collectionId,
      tags: input.tags,
      notes: input.notes,
      favorite: input.favorite ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.transaction("rw", db.references, db.thumbnails, async () => {
      await db.references.put(record);
      if (input.thumbnail) {
        await db.thumbnails.put({ id: record.id, blob: input.thumbnail });
      }
    });
    return toReference(record, input.thumbnail);
  },

  async updateReference(id, patch) {
    const existing = await db.references.get(id);
    if (!existing) return undefined;
    const { thumbnail, ...rest } = patch;
    const next: ReferenceRecord = {
      ...existing,
      ...rest,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
    };
    await db.transaction("rw", db.references, db.thumbnails, async () => {
      await db.references.put(next);
      if (thumbnail !== undefined) {
        if (thumbnail) await db.thumbnails.put({ id, blob: thumbnail });
        else await db.thumbnails.delete(id);
      }
    });
    const thumb = await db.thumbnails.get(id);
    return toReference(next, thumb?.blob ?? null);
  },

  async deleteReference(id) {
    await db.transaction("rw", db.references, db.thumbnails, async () => {
      await db.references.delete(id);
      await db.thumbnails.delete(id);
    });
  },

  async listCollections() {
    return db.collections.orderBy("sortOrder").toArray();
  },

  async createCollection(name) {
    const collections = await db.collections.toArray();
    const collection: Collection = {
      id: uid(),
      name: name.trim(),
      createdAt: now(),
      sortOrder: collections.length,
    };
    await db.collections.put(collection);
    return collection;
  },

  async renameCollection(id, name) {
    await db.collections.update(id, { name: name.trim() });
  },

  async deleteCollection(id) {
    await db.transaction("rw", db.collections, db.references, async () => {
      await db.collections.delete(id);
      await db.references.where("collectionId").equals(id).modify({
        collectionId: null,
        updatedAt: now(),
      });
    });
  },

  async seedIfEmpty() {
    const count = await db.collections.count();
    if (count > 0) return;
    const timestamp = now();
    await db.collections.bulkPut(
      DEFAULT_COLLECTIONS.map((name, index) => ({
        id: uid(),
        name,
        createdAt: timestamp,
        sortOrder: index,
      })),
    );
  },
};
