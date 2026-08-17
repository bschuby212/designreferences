import { getDb } from "./indexeddb";
import {
  DEFAULT_COLLECTIONS,
  type Collection,
  type CreateReferenceInput,
  type Reference,
  type ReferenceRecord,
} from "./types";
import { normalizeUrl, now, uid } from "../utils";

function toReference(
  record: ReferenceRecord,
  blob: Blob | null,
): Reference {
  return {
    ...record,
    thumbnailUrl: record.thumbnailUrl ?? null,
    imageUrls: record.imageUrls ?? [],
    comments: record.comments ?? [],
    thumbnail: blob,
  };
}

export interface LibraryRepository {
  listReferences(): Promise<Reference[]>;
  getReference(id: string): Promise<Reference | undefined>;
  findDuplicate(input: {
    url?: string | null;
    thumbnailUrl?: string | null;
  }): Promise<Reference | undefined>;
  dedupeReferences(retiredUrls?: string[]): Promise<number>;
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

  async findDuplicate(input) {
    const url = normalizeUrl(input.url ?? "");
    const thumbnailUrl = input.thumbnailUrl ?? "";
    if (!url && !thumbnailUrl) return undefined;
    const records = await getDb().references.toArray();
    const match = records.find((record) => {
      if (url && normalizeUrl(record.url) === url) return true;
      // Fall back to the image only when there is no URL to compare (e.g.
      // pasted/uploaded images that share the same source asset).
      if (!url && thumbnailUrl && record.thumbnailUrl === thumbnailUrl) return true;
      return false;
    });
    if (!match) return undefined;
    const thumb = await getDb().thumbnails.get(match.id);
    return toReference(match, thumb?.blob ?? null);
  },

  async dedupeReferences(retiredUrls = []) {
    const retired = new Set(
      retiredUrls.map((value) => normalizeUrl(value)).filter(Boolean),
    );
    // Oldest first so we always keep the earliest copy of a duplicate.
    const records = await getDb().references.orderBy("createdAt").toArray();
    const seen = new Set<string>();
    const toDelete: string[] = [];
    for (const record of records) {
      const url = normalizeUrl(record.url);
      if (url && retired.has(url)) {
        toDelete.push(record.id);
        continue;
      }
      // Only URL-backed references can be safely treated as duplicates; leave
      // user uploads (no URL) untouched.
      if (!url) continue;
      if (seen.has(url)) {
        toDelete.push(record.id);
        continue;
      }
      seen.add(url);
    }
    if (toDelete.length > 0) {
      await getDb().transaction(
        "rw",
        getDb().references,
        getDb().thumbnails,
        async () => {
          await getDb().references.bulkDelete(toDelete);
          await getDb().thumbnails.bulkDelete(toDelete);
        },
      );
    }
    return toDelete.length;
  },

  async createReference(input) {
    const duplicate = await this.findDuplicate({
      url: input.url,
      thumbnailUrl: input.thumbnailUrl ?? null,
    });
    if (duplicate) return duplicate;

    const timestamp = now();
    const record: ReferenceRecord = {
      id: uid(),
      title: input.title,
      url: input.url,
      thumbnailUrl: input.thumbnailUrl ?? null,
      thumbnailType: input.thumbnailType,
      imageUrls: input.imageUrls ?? [],
      source: input.source,
      collectionId: input.collectionId,
      tags: input.tags,
      notes: input.notes,
      comments: [],
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
      await getDb().references.where("collectionId").equals(id).modify({
        collectionId: null,
        updatedAt: now(),
      });
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
};
