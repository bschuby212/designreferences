"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, repository } from "@/lib/storage";
import { seedExampleReferences } from "@/lib/storage/seed-examples-runner";
import type {
  Collection,
  CreateReferenceInput,
  Reference,
} from "@/lib/storage/types";

interface LibraryContextValue {
  ready: boolean;
  references: Reference[];
  collections: Collection[];
  createReference: (input: CreateReferenceInput) => Promise<Reference>;
  updateReference: typeof repository.updateReference;
  deleteReference: (id: string) => Promise<void>;
  createCollection: (name: string) => Promise<Collection>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const records = useLiveQuery(() => {
    if (typeof window === "undefined") return [];
    return getDb().references.orderBy("createdAt").reverse().toArray();
  }, []);
  const collections = useLiveQuery(() => {
    if (typeof window === "undefined") return [];
    return getDb().collections.orderBy("sortOrder").toArray();
  }, []);
  const thumbs = useLiveQuery(() => {
    if (typeof window === "undefined") return [];
    return getDb().thumbnails.toArray();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await repository.seedIfEmpty();
        await seedExampleReferences();
      } catch (error) {
        console.error("Failed to seed library", error);
      }
    })();
  }, []);

  const references = useMemo<Reference[]>(() => {
    if (!records) return [];
    const byId = new Map((thumbs ?? []).map((t) => [t.id, t.blob]));
    return records.map((record) => ({
      ...record,
      thumbnailUrl: record.thumbnailUrl ?? null,
      thumbnail: byId.get(record.id) ?? null,
    }));
  }, [records, thumbs]);

  const createReference = useCallback(
    (input: CreateReferenceInput) => repository.createReference(input),
    [],
  );
  const updateReference = useCallback(
    (...args: Parameters<typeof repository.updateReference>) =>
      repository.updateReference(...args),
    [],
  );
  const deleteReference = useCallback(
    (id: string) => repository.deleteReference(id),
    [],
  );
  const createCollection = useCallback(
    (name: string) => repository.createCollection(name),
    [],
  );
  const renameCollection = useCallback(
    (id: string, name: string) => repository.renameCollection(id, name),
    [],
  );
  const deleteCollection = useCallback(
    (id: string) => repository.deleteCollection(id),
    [],
  );

  const value = useMemo(
    () => ({
      ready: records !== undefined && collections !== undefined,
      references,
      collections: collections ?? [],
      createReference,
      updateReference,
      deleteReference,
      createCollection,
      renameCollection,
      deleteCollection,
    }),
    [
      records,
      collections,
      references,
      createReference,
      updateReference,
      deleteReference,
      createCollection,
      renameCollection,
      deleteCollection,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
