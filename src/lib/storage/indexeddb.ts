import Dexie, { type Table } from "dexie";
import type {
  Collection,
  ReferenceRecord,
  ThumbnailRecord,
} from "./types";

export class LibraryDB extends Dexie {
  references!: Table<ReferenceRecord, string>;
  collections!: Table<Collection, string>;
  thumbnails!: Table<ThumbnailRecord, string>;

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
