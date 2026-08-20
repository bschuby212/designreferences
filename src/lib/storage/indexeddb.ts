import Dexie, { type Table } from "dexie";
import type {
  Collection,
  MetaRecord,
  ReferenceRecord,
  ThumbnailRecord,
} from "./types";

/**
 * v3 replaced the single `collectionId` with a multi-entry `collectionIds`
 * (a reference can legitimately belong to more than one collection) and added
 * the `screens` list that backs the carousels. Existing rows are migrated
 * rather than dropped so anything a user saved themselves survives.
 */
export class LibraryDB extends Dexie {
  references!: Table<ReferenceRecord, string>;
  collections!: Table<Collection, string>;
  thumbnails!: Table<ThumbnailRecord, string>;
  meta!: Table<MetaRecord, string>;

  constructor() {
    super("design-reference-library");
    this.version(1).stores({
      references: "id, source, collectionId, favorite, createdAt, updatedAt",
      collections: "id, sortOrder, name",
      thumbnails: "id",
    });
    this.version(2).stores({
      references: "id, source, collectionId, favorite, createdAt, updatedAt",
      collections: "id, sortOrder, name",
      thumbnails: "id",
    });
    this.version(3)
      .stores({
        references:
          "id, source, *collectionIds, favorite, createdAt, updatedAt, seedKey",
        collections: "id, sortOrder, name",
        thumbnails: "id",
        meta: "key",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("references")
          .toCollection()
          .modify((record: ReferenceRecord & { collectionId?: string | null }) => {
            const previous = record.collectionId;
            record.collectionIds = previous ? [previous] : [];
            delete record.collectionId;
            if (!Array.isArray(record.screens)) {
              record.screens = record.thumbnailUrl
                ? [{ src: record.thumbnailUrl, label: "Screen 1" }]
                : [];
            }
            if (record.aspect === undefined) record.aspect = null;
            if (record.seedKey === undefined) record.seedKey = null;
          });
      });
  }
}

let instance: LibraryDB | null = null;

export function getDb() {
  if (typeof window === "undefined") {
    throw new Error("Library storage is only available in the browser");
  }
  if (!instance) instance = new LibraryDB();
  return instance;
}
